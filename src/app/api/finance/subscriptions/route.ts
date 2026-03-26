import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { mergeSubscriptions, normalizeFrequency, type UnifiedSubscription, type TransactionDateMap } from "@/lib/finance/subscription-merge"
import { classifyBillType, enrichMerchantName } from "@/lib/finance/bill-type-classifier"
import { backfillBillTypes } from "@/lib/finance/backfill-bill-types"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

/** Detect gibberish merchant names (raw Plaid tokens, base64, hex strings) */
function isGibberishName(name: string): boolean {
  const n = name.trim()
  if (n.length === 0) return true
  if (n.length > 20 && !/\s/.test(n)) return true
  if (/^[A-Za-z0-9+/=]{20,}$/.test(n)) return true
  if (/^[0-9a-f]{16,}$/i.test(n)) return true
  return false
}

/** Clean a merchant name from Plaid, falling back to description or generic label */
function cleanMerchantName(merchantName: string | null, description?: string | null): string {
  if (merchantName && !isGibberishName(merchantName)) return merchantName
  if (description && !isGibberishName(description)) return description
  return "Unknown Subscription"
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6001", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status")

  try {
    // Lazy migration: backfill billType for existing subscriptions
    await backfillBillTypes(user.id)

    // One-time cleanup: fix any stored gibberish merchant names
    const gibberishSubs = await db.financeSubscription.findMany({
      where: { userId: user.id },
      select: { id: true, merchantName: true, nickname: true, category: true },
    })
    const nameFixUpdates = gibberishSubs
      .filter((s) => isGibberishName(s.merchantName))
      .map((s) => db.financeSubscription.update({
        where: { id: s.id },
        data: { merchantName: s.nickname ?? s.category ?? "Unknown Subscription" },
      }))
    if (nameFixUpdates.length > 0) {
      await Promise.all(nameFixUpdates).catch(() => { /* best-effort */ })
    }

    const [subscriptions, dismissedSubs, plaidStreams] = await Promise.all([
      db.financeSubscription.findMany({
        where: {
          userId: user.id,
          ...(status ? { status } : { status: { not: "dismissed" } }),
        },
        orderBy: { amount: "desc" },
      }),
      // Also fetch dismissed subs so merge can match their Plaid streams and exclude them
      status !== "dismissed"
        ? db.financeSubscription.findMany({
            where: { userId: user.id, status: "dismissed" },
            select: { merchantName: true, amount: true, accountId: true },
          })
        : Promise.resolve([]),
      db.financeRecurringStream.findMany({
        where: { userId: user.id },
      }),
    ])

    // Build transaction date map for Plaid frequency override
    const allPlaidTxIds = plaidStreams.flatMap((s) => s.transactionIds ?? [])
    let transactionDateMap: TransactionDateMap | undefined
    if (allPlaidTxIds.length > 0) {
      const plaidTxs = await db.financeTransaction.findMany({
        where: { userId: user.id, externalId: { in: allPlaidTxIds } },
        select: { externalId: true, date: true },
      })
      transactionDateMap = new Map(
        plaidTxs
          .filter((t): t is typeof t & { externalId: string } => t.externalId != null)
          .map((t) => [t.externalId, t.date])
      )
    }

    // Filter out Plaid streams whose merchant was dismissed by the user
    const dismissedKeys = new Set(
      dismissedSubs.map((d) => `${d.merchantName.toLowerCase()}|${d.accountId ?? ""}`)
    )
    const dismissedNames = new Set(dismissedSubs.map((d) => d.merchantName.toLowerCase()))
    const filteredPlaidStreams = plaidStreams.filter((ps) => {
      const name = (ps.merchantName ?? ps.description).toLowerCase()
      // Match by name+account (precise) or just name (fallback)
      const key = `${name}|${ps.accountId ?? ""}`
      return !dismissedKeys.has(key) && !dismissedNames.has(name)
    })

    // Merge detected + provider streams into unified list
    const unified = mergeSubscriptions(
      subscriptions.map((s) => ({
        ...s,
        nickname: s.nickname ?? null,
      })),
      filteredPlaidStreams as any,
      transactionDateMap,
    )

    // Collect unique accountIds for payment method lookup
    const accountIds = [...new Set(
      unified.map((s) => s.accountId).filter((id): id is string => id != null)
    )]

    // Batch fetch: merchant logos, account info, and recent transactions
    const merchantNames = [...new Set(unified.map((s) => s.merchantName))]

    const [logoTxs, accounts, recentTxs] = await Promise.all([
      merchantNames.length > 0
        ? db.financeTransaction.findMany({
            where: { userId: user.id, merchantName: { in: merchantNames }, logoUrl: { not: null } },
            select: { merchantName: true, logoUrl: true },
            distinct: ["merchantName"],
          })
        : [],
      accountIds.length > 0
        ? db.financeAccount.findMany({
            where: { id: { in: accountIds } },
            select: {
              id: true,
              name: true,
              type: true,
              subtype: true,
              mask: true,
              institution: { select: { institutionName: true } },
            },
          })
        : [],
      merchantNames.length > 0
        ? db.financeTransaction.findMany({
            where: {
              userId: user.id,
              merchantName: { in: merchantNames },
              isDuplicate: false,
              isExcluded: false,
            },
            orderBy: { date: "desc" },
            take: 5 * merchantNames.length,
            select: {
              merchantName: true,
              name: true,
              amount: true,
              date: true,
              accountId: true,
            },
          })
        : [],
    ])

    const logoMap = new Map(logoTxs.map((t) => [t.merchantName, t.logoUrl]))

    // Batch-fetch linked transactions (the exact charge that proves "paid")
    const linkedTxIds = subscriptions
      .map((s) => s.lastTransactionId)
      .filter((id): id is string => id != null)
    const linkedTxs = linkedTxIds.length > 0
      ? await db.financeTransaction.findMany({
          where: { id: { in: linkedTxIds } },
          select: {
            id: true,
            name: true,
            merchantName: true,
            amount: true,
            date: true,
            accountId: true,
            category: true,
            account: { select: { name: true, mask: true, institution: { select: { institutionName: true } } } },
          },
        })
      : []
    const linkedTxMap = new Map(linkedTxs.map((t) => [t.id, {
      id: t.id,
      name: t.name,
      merchantName: t.merchantName,
      amount: t.amount,
      date: t.date.toISOString().split("T")[0],
      accountName: t.account?.name ?? null,
      accountMask: t.account?.mask ?? null,
      institutionName: t.account?.institution?.institutionName ?? null,
      category: t.category,
    }]))

    const accountMap = new Map(
      accounts.map((a) => [a.id, {
        accountName: formatAccountLabel(a),
        accountMask: a.mask,
        accountType: a.subtype ?? a.type,
        institutionName: a.institution?.institutionName ?? null,
      }])
    )

    // Group recent transactions by merchant, take top 5 per merchant
    const txByMerchant = new Map<string, Array<{ amount: number; date: string; name: string }>>()
    for (const tx of recentTxs) {
      const key = tx.merchantName ?? ""
      const list = txByMerchant.get(key) ?? []
      if (list.length < 5) {
        list.push({
          amount: tx.amount,
          date: tx.date.toISOString().split("T")[0],
          name: tx.name,
        })
      }
      txByMerchant.set(key, list)
    }

    // Build full account detail map (type + subtype) for bill type classification
    const accountDetailMap = new Map(
      accounts.map((a) => [a.id, {
        type: a.type,
        subtype: a.subtype,
      }])
    )

    const enriched = unified.map((s) => {
      const acct = s.accountId ? accountMap.get(s.accountId) : null
      const acctDetail = s.accountId ? accountDetailMap.get(s.accountId) : null

      // Classify bill type if not already set
      const { billType, reason } = s.billType
        ? { billType: s.billType, reason: "Already classified" }
        : classifyBillType({
            merchantName: s.merchantName,
            frequency: s.frequency,
            category: s.category,
            amount: s.amount,
            accountType: acctDetail?.type ?? null,
            accountSubtype: acctDetail?.subtype ?? null,
          })

      // Enrich generic merchant names (e.g., "ANNUAL MEMBERSHIP FEE" → "Chase ••••8402 Annual Fee")
      const displayName = enrichMerchantName(
        s.nickname ?? s.merchantName,
        acct?.institutionName ?? null,
        acct?.accountMask ?? null,
      )

      return {
        ...s,
        merchantName: displayName,
        originalMerchantName: s.merchantName,
        billType,
        classificationReason: reason,
        logoUrl: logoMap.get(s.merchantName) ?? null,
        accountName: acct?.accountName ?? null,
        accountMask: acct?.accountMask ?? null,
        accountType: acct?.accountType ?? null,
        institutionName: acct?.institutionName ?? null,
        recentTransactions: txByMerchant.get(s.merchantName) ?? [],
        linkedTransaction: (s as { lastTransactionId?: string }).lastTransactionId ? linkedTxMap.get((s as { lastTransactionId?: string }).lastTransactionId!) ?? null : null,
      }
    })

    // Filter by status after merge (for provider-only items that always have status "active")
    const filtered = status
      ? enriched.filter((s) => s.status === status)
      : enriched

    const monthlyTotal = filtered
      .filter((s) => s.status === "active")
      .reduce((sum, s) => {
        switch (s.frequency) {
          case "weekly": return sum + s.amount * 4.33
          case "biweekly": return sum + s.amount * 2.17
          case "monthly": return sum + s.amount
          case "quarterly": return sum + s.amount / 3
          case "semi_annual": return sum + s.amount / 6
          case "yearly": return sum + s.amount / 12
          default: return sum
        }
      }, 0)

    // Separate provider inflows for optional income section
    const inflows = plaidStreams
      .filter((s: any) => s.streamType === "inflow")
      .map((s: any) => ({
        streamId: s.streamId,
        merchantName: cleanMerchantName(s.merchantName, s.description),
        amount: s.lastAmount ?? s.averageAmount ?? 0,
        averageAmount: s.averageAmount,
        frequency: s.frequency,
        isActive: s.isActive,
      }))

    return NextResponse.json({
      subscriptions: filtered,
      monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      yearlyTotal: Math.round(monthlyTotal * 12 * 100) / 100,
      inflows,
    })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch subscriptions")
    return apiError("F6002", mapped.message, mapped.status, err)
  }
}

function formatAccountLabel(account: {
  name: string
  mask: string | null
  institution?: { institutionName: string | null } | null
}): string {
  const label = account.institution?.institutionName ?? account.name
  if (account.mask) {
    return `${label} ····${account.mask}`
  }
  return label
}

const patchSchema = z.object({
  subscriptionId: z.string().min(1, "subscriptionId required"),
  status: z.enum(["active", "paused", "cancelled", "flagged", "dismissed"]).optional(),
  isWanted: z.boolean().optional(),
  notes: z.string().max(2000).optional(),
  nickname: z.string().max(100).nullable().optional(),
  frequency: z.enum(["weekly", "biweekly", "monthly", "quarterly", "semi_annual", "yearly"]).optional(),
  category: z.string().max(100).nullable().optional(),
  cancelReminderDate: z.string().datetime().nullable().optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6010", "Authentication required", 401)

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F6011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { subscriptionId, status, isWanted, notes, nickname, frequency, category, cancelReminderDate } = parsed.data

  try {
    // Handle provider-only virtual subscriptions — auto-materialize on first interaction
    if (subscriptionId.startsWith("plaid:")) {
      const streamId = subscriptionId.slice(6)
      const stream = await db.financeRecurringStream.findFirst({
        where: { userId: user.id, streamId },
      })
      if (!stream) return apiError("F6012", "Subscription not found", 404)

      // Create a real FinanceSubscription from the provider stream
      const created = await db.financeSubscription.create({
        data: {
          userId: user.id,
          merchantName: cleanMerchantName(stream.merchantName, stream.description),
          nickname: nickname ?? null,
          amount: stream.lastAmount ?? stream.averageAmount ?? 0,
          frequency: frequency ?? normalizeFrequency(stream.frequency),
          category: category !== undefined ? category : (stream.category ?? null),
          accountId: stream.accountId,
          lastChargeDate: stream.lastDate,
          status: status ?? "active",
          isWanted: isWanted ?? true,
          notes: notes ?? null,
        },
      })

      return NextResponse.json(created)
    }

    // Standard update for detected/merged subscriptions
    const sub = await db.financeSubscription.findFirst({
      where: { id: subscriptionId, userId: user.id },
    })
    if (!sub) return apiError("F6012", "Subscription not found", 404)

    const updated = await db.financeSubscription.update({
      where: { id: subscriptionId },
      data: {
        ...(status !== undefined && { status }),
        ...(isWanted !== undefined && { isWanted }),
        ...(notes !== undefined && { notes }),
        ...(nickname !== undefined && { nickname }),
        ...(frequency !== undefined && { frequency }),
        ...(category !== undefined && { category }),
        ...(cancelReminderDate !== undefined && {
          cancelReminderDate: cancelReminderDate ? new Date(cancelReminderDate) : null,
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to update subscription")
    return apiError("F6013", mapped.message, mapped.status, err)
  }
}
