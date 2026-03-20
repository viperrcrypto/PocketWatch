import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { mapFinanceError } from "@/lib/finance/error-map"
import { resolveInstitutionLogo } from "@/lib/finance/institution-logos"
import { removeItem } from "@/lib/finance/plaid-client"
import { invalidateCache } from "@/lib/cache"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F3001", "Authentication required", 401)

  try {
    const institutions = await db.financeInstitution.findMany({
      where: { userId: user.id, status: { not: "disconnected" } },
      include: {
        accounts: {
          orderBy: { name: "asc" },
          select: {
            id: true, externalId: true, linkedExternalId: true, name: true,
            type: true, subtype: true, mask: true,
            currentBalance: true, availableBalance: true, creditLimit: true,
            currency: true, isHidden: true,
          },
        },
      },
      orderBy: { institutionName: "asc" },
    })

    // Backfill missing, stale (Clearbit), or raw base64 logos
    const backfillPromises: Promise<unknown>[] = []
    for (const inst of institutions) {
      const logo = inst.institutionLogo
      const isStale = !logo || logo.includes("logo.clearbit.com")
      const isRawBase64 = logo && logo.length > 100 && !logo.startsWith("http") && !logo.startsWith("data:")

      if (isRawBase64) {
        // Fix raw base64 by adding the data URI prefix
        const fixed = `data:image/png;base64,${logo}`
        inst.institutionLogo = fixed
        backfillPromises.push(
          db.financeInstitution.update({
            where: { id: inst.id },
            data: { institutionLogo: fixed },
          })
        )
      } else if (isStale) {
        const resolved = resolveInstitutionLogo(null, null, inst.institutionName)
        if (resolved) {
          inst.institutionLogo = resolved
          backfillPromises.push(
            db.financeInstitution.update({
              where: { id: inst.id },
              data: { institutionLogo: resolved },
            })
          )
        }
      }
    }
    // Fire-and-forget — don't block the response
    if (backfillPromises.length > 0) {
      Promise.all(backfillPromises).catch(console.error)
    }

    const result = institutions.map((inst) => ({
      id: inst.id,
      provider: inst.provider,
      institutionName: inst.institutionName,
      institutionLogo: inst.institutionLogo,
      status: inst.status,
      errorMessage: inst.errorMessage,
      lastSyncedAt: inst.lastSyncedAt,
      accounts: inst.accounts.map((a) => ({
        id: a.id,
        externalId: a.externalId,
        linkedExternalId: a.linkedExternalId,
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
        currentBalance: a.currentBalance,
        availableBalance: a.availableBalance,
        creditLimit: a.creditLimit,
        currency: a.currency,
        isHidden: a.isHidden,
      })),
    }))

    return NextResponse.json(result)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch accounts")
    return apiError("F3002", mapped.message, mapped.status, err)
  }
}

const VALID_ACCOUNT_TYPES = ["checking", "savings", "credit", "business_credit", "investment", "loan", "mortgage"] as const

const accountPatchSchema = z.object({
  accountId: z.string().min(1, "accountId required"),
  name: z.string().min(1).max(200).optional(),
  isHidden: z.boolean().optional(),
  type: z.enum(VALID_ACCOUNT_TYPES).optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F3010", "Authentication required", 401)

  const body = await req.json()
  const parsed = accountPatchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F3011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { accountId, name, isHidden, type } = parsed.data

  try {
    const account = await db.financeAccount.findFirst({
      where: { id: accountId, userId: user.id },
      include: { institution: { select: { institutionName: true } } },
    })
    if (!account) return apiError("F3012", "Account not found", 404)

    const updated = await db.financeAccount.update({
      where: { id: accountId },
      data: {
        ...(name !== undefined && { name }),
        ...(isHidden !== undefined && { isHidden }),
        ...(type !== undefined && { type }),
      },
    })

    // Auto-create card profile when reclassifying to credit
    if (type === "credit" || type === "business_credit") {
      const existingProfile = await db.creditCardProfile.findFirst({ where: { accountId } })
      if (!existingProfile) {
        const cardName = name ?? account.name
        await db.creditCardProfile.create({
          data: {
            userId: user.id,
            accountId,
            cardName,
            cardNetwork: "visa",
            rewardType: "cashback",
            baseRewardRate: 1,
            annualFee: 0,
            bonusCategories: [],
          },
        }).catch(() => { /* ignore duplicate */ })
      }
    }

    // Remove card profile when reclassifying away from credit
    if (type && type !== "credit" && type !== "business_credit" && account.type !== type) {
      await db.creditCardProfile.deleteMany({ where: { accountId } }).catch(() => {})
    }

    return NextResponse.json(updated)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to update account")
    return apiError("F3013", mapped.message, mapped.status, err)
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F3020", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const accountId = searchParams.get("accountId")
  const institutionId = searchParams.get("institutionId")

  // Single-account deletion
  if (accountId) {
    return deleteAccount(user.id, accountId)
  }

  if (!institutionId) return apiError("F3021", "institutionId or accountId required", 400)

  try {
    const institution = await db.financeInstitution.findFirst({
      where: { id: institutionId, userId: user.id },
    })
    if (!institution) return apiError("F3022", "Institution not found", 404)

    // Remove from Plaid only if no other institutions share the same Plaid item
    if (institution.provider === "plaid" && institution.plaidAccessToken && institution.plaidItemId) {
      const siblings = await db.financeInstitution.count({
        where: { userId: user.id, plaidItemId: institution.plaidItemId, id: { not: institutionId } },
      })
      if (siblings === 0) {
        try {
          const token = await decryptCredential(institution.plaidAccessToken)
          await removeItem(user.id, token)
        } catch {
          // Best effort — continue with local cleanup
        }
      }
    }

    // Collect account IDs before cascade delete so we can clean up orphaned models
    const accounts = await db.financeAccount.findMany({
      where: { institutionId },
      select: { id: true },
    })
    const accountIds = accounts.map((a) => a.id)

    // Delete orphaned records that have no FK cascade from FinanceAccount
    if (accountIds.length > 0) {
      await Promise.all([
        // CreditCardProfile: accountId stored as plain string, not FK
        db.creditCardProfile.deleteMany({
          where: { userId: user.id, accountId: { in: accountIds } },
        }),
        // FinanceSubscription: accountId is optional, only delete linked ones
        db.financeSubscription.deleteMany({
          where: { userId: user.id, accountId: { in: accountIds } },
        }),
        // FinanceRecurringStream: always linked to an account
        db.financeRecurringStream.deleteMany({
          where: { userId: user.id, accountId: { in: accountIds } },
        }),
      ])
    }

    // Cascade delete handles accounts + transactions
    await db.financeInstitution.delete({
      where: { id: institutionId },
    })

    // Always wipe snapshots — they bake in balances from all banks, so stale data
    // persists if we only delete them when the last institution is removed.
    // The next snapshot load (GET /api/finance/snapshots) will regenerate from remaining banks.
    await db.financeSnapshot.deleteMany({ where: { userId: user.id } })

    // If this was the last institution, also wipe budgets, subscriptions, etc.
    const remainingInstitutions = await db.financeInstitution.count({ where: { userId: user.id } })
    if (remainingInstitutions === 0) {
      await Promise.all([
        db.financeBudget.deleteMany({ where: { userId: user.id } }),
        db.financeSubscription.deleteMany({ where: { userId: user.id } }),
        db.financeRecurringStream.deleteMany({ where: { userId: user.id } }),
        db.creditCardProfile.deleteMany({ where: { userId: user.id } }),
      ])
    }

    // Flush server-side in-memory caches so stale data doesn't render
    invalidateCache(`finance-insights:${user.id}`)
    invalidateCache(`deep-insights:${user.id}`)
    invalidateCache(`finance-trends:${user.id}`)
    invalidateCache(`finance-spending-by-month:${user.id}`)
    invalidateCache(`budget-suggest:${user.id}`)
    invalidateCache(`budget-ai:${user.id}`)
    invalidateCache(`ai-insights:${user.id}`)
    invalidateCache(`${user.id}:`)

    return NextResponse.json({ deleted: true })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to disconnect institution")
    return apiError("F3023", mapped.message, mapped.status, err)
  }
}

// ─── Single Account Deletion ───────────────────────────────────

async function deleteAccount(userId: string, accountId: string) {
  try {
    const account = await db.financeAccount.findFirst({
      where: { id: accountId, userId },
      include: {
        institution: {
          select: { id: true, provider: true, plaidItemId: true, plaidAccessToken: true },
        },
      },
    })
    if (!account) return apiError("F3030", "Account not found", 404)

    // Clean up orphaned records (no FK cascade from FinanceAccount)
    await Promise.all([
      db.creditCardProfile.deleteMany({ where: { userId, accountId } }),
      db.financeSubscription.deleteMany({ where: { userId, accountId } }),
      db.financeRecurringStream.deleteMany({ where: { userId, accountId } }),
    ])

    // Delete the account (cascades to transactions, liabilities, holdings, identities)
    await db.financeAccount.delete({ where: { id: accountId } })

    // If institution has no remaining accounts, remove the institution too
    let institutionRemoved = false
    const remainingAccounts = await db.financeAccount.count({
      where: { institutionId: account.institution.id },
    })
    if (remainingAccounts === 0) {
      const inst = account.institution

      // Revoke Plaid item if no siblings share it
      if (inst.provider === "plaid" && inst.plaidAccessToken && inst.plaidItemId) {
        const siblings = await db.financeInstitution.count({
          where: { userId, plaidItemId: inst.plaidItemId, id: { not: inst.id } },
        })
        if (siblings === 0) {
          try {
            const token = await decryptCredential(inst.plaidAccessToken)
            await removeItem(userId, token)
          } catch {
            // Best effort
          }
        }
      }

      await db.financeInstitution.delete({ where: { id: inst.id } })
      institutionRemoved = true

      // If that was the last institution, clean up global data
      const remainingInstitutions = await db.financeInstitution.count({ where: { userId } })
      if (remainingInstitutions === 0) {
        await Promise.all([
          db.financeBudget.deleteMany({ where: { userId } }),
          db.financeSubscription.deleteMany({ where: { userId } }),
          db.financeRecurringStream.deleteMany({ where: { userId } }),
          db.creditCardProfile.deleteMany({ where: { userId } }),
        ])
      }
    }

    // Wipe snapshots — they bake in balances from all accounts
    await db.financeSnapshot.deleteMany({ where: { userId } })

    // Flush caches
    invalidateCache(`finance-insights:${userId}`)
    invalidateCache(`deep-insights:${userId}`)
    invalidateCache(`finance-trends:${userId}`)
    invalidateCache(`finance-spending-by-month:${userId}`)
    invalidateCache(`budget-suggest:${userId}`)
    invalidateCache(`budget-ai:${userId}`)
    invalidateCache(`ai-insights:${userId}`)
    invalidateCache(`${userId}:`)

    return NextResponse.json({ deleted: true, institutionRemoved })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to delete account")
    return apiError("F3031", mapped.message, mapped.status, err)
  }
}
