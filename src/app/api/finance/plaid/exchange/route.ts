import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { exchangePublicToken, getAccounts, getInstitution } from "@/lib/finance/plaid-client"
import { encryptCredential } from "@/lib/finance/crypto"
import { mapFinanceError } from "@/lib/finance/error-map"
import { syncInstitution, fetchFullPlaidHistory } from "@/lib/finance/sync"
import { syncAllPlaidData } from "@/lib/finance/plaid-data-sync"
import { resolveInstitutionLogo } from "@/lib/finance/institution-logos"
import { financeRateLimiters, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const schema = z.object({
  publicToken: z.string().min(1),
  institutionId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F1010", "Authentication required", 401)

  const rl = financeRateLimiters.exchange(`exchange:${user.id}`)
  if (!rl.success) {
    return apiError("F1015", "Rate limit exceeded. Try again later.", 429, undefined, rateLimitHeaders(rl))
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError("F1011", "Invalid request body", 400)

  try {
    console.info("[finance.plaid.exchange.start]", {
      ref: "F1012",
      userId: user.id,
      provider: "plaid",
      verifyCode: "n/a",
      institutionId: parsed.data.institutionId,
    })

    const { accessToken, itemId } = await exchangePublicToken(user.id, parsed.data.publicToken)
    const encryptedToken = await encryptCredential(accessToken)

    // Get institution info
    const instInfo = await getInstitution(user.id, parsed.data.institutionId)

    // Resolve institution logo with fallback chain
    const resolvedLogo = resolveInstitutionLogo(
      instInfo.logo,
      parsed.data.institutionId,
      instInfo.name
    )

    // Create institution record
    const institution = await db.financeInstitution.create({
      data: {
        userId: user.id,
        provider: "plaid",
        institutionName: instInfo.name,
        institutionLogo: resolvedLogo,
        plaidItemId: itemId,
        plaidAccessToken: encryptedToken,
        status: "active",
      },
    })

    // Fetch and create accounts
    const plaidAccounts = await getAccounts(user.id, accessToken)
    for (const pa of plaidAccounts) {
      await db.financeAccount.create({
        data: {
          userId: user.id,
          institutionId: institution.id,
          externalId: pa.accountId,
          name: pa.name,
          officialName: pa.officialName,
          type: mapPlaidType(pa.type, pa.subtype),
          subtype: pa.subtype,
          mask: pa.mask,
          currentBalance: pa.balances.current,
          availableBalance: pa.balances.available,
          creditLimit: pa.balances.limit,
          currency: pa.balances.isoCurrencyCode ?? "USD",
        },
      })
    }

    // Await initial sync so the client gets feedback
    let syncStatus: { transactionsAdded: number; error: string | null } = {
      transactionsAdded: 0,
      error: null,
    }
    try {
      const syncResult = await syncInstitution(institution.id)
      syncStatus = {
        transactionsAdded: syncResult.transactionsAdded,
        error: syncResult.error,
      }
    } catch (syncErr) {
      syncStatus.error = syncErr instanceof Error ? syncErr.message : "Sync failed"
    }

    // Kick off deep history fetch + comprehensive data sync in background
    fetchFullPlaidHistory(user.id).catch((err) =>
      console.warn("[finance.plaid.exchange.deepHistory.failed]", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
    )
    syncAllPlaidData(user.id).catch((err) =>
      console.warn("[finance.plaid.exchange.comprehensiveSync.failed]", {
        userId: user.id,
        error: err instanceof Error ? err.message : String(err),
      })
    )

    console.info("[finance.plaid.exchange.success]", {
      ref: "F1012",
      userId: user.id,
      provider: "plaid",
      verifyCode: "n/a",
      institutionId: institution.id,
    })

    return NextResponse.json({
      institutionId: institution.id,
      institutionName: instInfo.name,
      accountCount: plaidAccounts.length,
      syncStatus,
    })
  } catch (err) {
    console.warn("[finance.plaid.exchange.failed]", {
      ref: "F1012",
      userId: user.id,
      provider: "plaid",
      verifyCode: "n/a",
      institutionId: parsed.data.institutionId,
    })
    const mapped = mapFinanceError(err, "Failed to connect bank")
    return apiError("F1012", mapped.message, mapped.status, err)
  }
}

function mapPlaidType(type: string, subtype: string | null): string {
  if (type === "credit") return "credit"
  if (type === "loan") return subtype === "mortgage" ? "mortgage" : "loan"
  if (type === "investment") return "investment"
  if (subtype === "savings") return "savings"
  return "checking"
}
