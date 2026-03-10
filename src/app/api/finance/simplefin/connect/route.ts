import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { claimSetupToken, getAccountsAndTransactions, normalizeSimpleFINData } from "@/lib/finance/simplefin-client"
import { encryptCredential } from "@/lib/finance/crypto"
import { resolveInstitutionLogo } from "@/lib/finance/institution-logos"
import { mapFinanceError } from "@/lib/finance/error-map"
import { syncInstitution } from "@/lib/finance/sync"
import { financeRateLimiters, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const schema = z.object({
  setupToken: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F2001", "Authentication required", 401)

  const rl = financeRateLimiters.simplefinConnect(`sfin:${user.id}`)
  if (!rl.success) {
    return apiError("F2005", "Rate limit exceeded. Try again later.", 429, undefined, rateLimitHeaders(rl))
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return apiError("F2002", "Invalid setup token", 400)

  try {
    console.info("[finance.simplefin.connect.start]", {
      ref: "F2004",
      userId: user.id,
      provider: "simplefin",
      verifyCode: "n/a",
    })

    // Claim the setup token to get access URL
    const accessUrl = await claimSetupToken(parsed.data.setupToken)
    const encryptedUrl = await encryptCredential(accessUrl)

    // Fetch initial data to get institution name
    const raw = await getAccountsAndTransactions(accessUrl)
    const normalized = normalizeSimpleFINData(raw)

    if (normalized.accounts.length === 0) {
      return apiError("F2003", "No accounts found", 400)
    }

    // Use first account's org name as institution name
    const institutionName = raw.accounts[0]?.org?.name ?? "SimpleFIN Bank"

    // Resolve institution logo from SimpleFIN org data
    const orgUrl = raw.accounts[0]?.org?.url ?? null
    const logoUrl = resolveInstitutionLogo(null, null, institutionName) ?? orgUrl

    // Create institution
    const institution = await db.financeInstitution.create({
      data: {
        userId: user.id,
        provider: "simplefin",
        institutionName,
        institutionLogo: logoUrl,
        simplefinAccessUrl: encryptedUrl,
        status: "active",
      },
    })

    // Create accounts
    for (const acct of normalized.accounts) {
      await db.financeAccount.create({
        data: {
          userId: user.id,
          institutionId: institution.id,
          externalId: acct.externalId,
          name: acct.accountName,
          type: acct.type,
          currentBalance: acct.currentBalance,
          availableBalance: acct.availableBalance,
          currency: acct.currency,
        },
      })
    }

    // Trigger full sync (fire-and-forget)
    syncInstitution(institution.id).catch(console.error)

    console.info("[finance.simplefin.connect.success]", {
      ref: "F2004",
      userId: user.id,
      provider: "simplefin",
      verifyCode: "n/a",
      institutionId: institution.id,
    })

    return NextResponse.json({
      institutionId: institution.id,
      institutionName,
      accountCount: normalized.accounts.length,
    })
  } catch (err) {
    console.warn("[finance.simplefin.connect.failed]", {
      ref: "F2004",
      userId: user.id,
      provider: "simplefin",
      verifyCode: "n/a",
    })
    const mapped = mapFinanceError(err, "Failed to connect SimpleFIN")
    return apiError("F2004", mapped.message, mapped.status, err)
  }
}
