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

    // Group accounts by org name — SimpleFIN returns all institutions in one response
    const accountsByOrg = new Map<string, typeof raw.accounts>()
    for (const acct of raw.accounts) {
      const orgName = acct.org?.name ?? "SimpleFIN Bank"
      const existing = accountsByOrg.get(orgName) ?? []
      accountsByOrg.set(orgName, [...existing, acct])
    }

    const createdInstitutions: Array<{ id: string; name: string; accountCount: number }> = []

    for (const [orgName, orgAccounts] of accountsByOrg) {
      const orgUrl = orgAccounts[0]?.org?.url ?? null
      const logoUrl = resolveInstitutionLogo(null, null, orgName) ?? orgUrl

      // Check if this institution already exists for this user
      const existing = await db.financeInstitution.findFirst({
        where: { userId: user.id, provider: "simplefin", institutionName: orgName },
      })

      const institution = existing
        ? await db.financeInstitution.update({
            where: { id: existing.id },
            data: { simplefinAccessUrl: encryptedUrl, status: "active" },
          })
        : await db.financeInstitution.create({
            data: {
              userId: user.id,
              provider: "simplefin",
              institutionName: orgName,
              institutionLogo: logoUrl,
              simplefinAccessUrl: encryptedUrl,
              status: "active",
            },
          })

      // Upsert accounts for this institution
      const normalizedOrg = normalizeSimpleFINData({ errors: [], accounts: orgAccounts })
      for (const acct of normalizedOrg.accounts) {
        await db.financeAccount.upsert({
          where: {
            userId_externalId: { userId: user.id, externalId: acct.externalId },
          },
          create: {
            userId: user.id,
            institutionId: institution.id,
            externalId: acct.externalId,
            name: acct.accountName,
            type: acct.type,
            mask: acct.mask,
            currentBalance: acct.currentBalance,
            availableBalance: acct.availableBalance,
            currency: acct.currency,
          },
          update: {
            institutionId: institution.id,
            name: acct.accountName,
            type: acct.type,
            mask: acct.mask,
            currentBalance: acct.currentBalance,
            availableBalance: acct.availableBalance,
          },
        })
      }

      createdInstitutions.push({
        id: institution.id,
        name: orgName,
        accountCount: normalizedOrg.accounts.length,
      })

      // Trigger full sync (fire-and-forget)
      syncInstitution(institution.id).catch(console.error)
    }

    console.info("[finance.simplefin.connect.success]", {
      ref: "F2004",
      userId: user.id,
      provider: "simplefin",
      verifyCode: "n/a",
      institutions: createdInstitutions.map((i) => i.id),
    })

    const totalAccounts = createdInstitutions.reduce((sum, i) => sum + i.accountCount, 0)
    const names = createdInstitutions.map((i) => i.name).join(", ")

    return NextResponse.json({
      institutionId: createdInstitutions[0]?.id,
      institutionName: names,
      accountCount: totalAccounts,
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
