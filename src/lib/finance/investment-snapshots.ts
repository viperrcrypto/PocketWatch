import { db } from "@/lib/db"

type RangeKey = "1w" | "1m" | "3m" | "6m" | "1y" | "all"

export function rangeToDate(range: string): Date {
  const now = new Date()
  const start = new Date(now)

  switch (range as RangeKey) {
    case "1w":
      start.setDate(start.getDate() - 7)
      break
    case "1m":
      start.setMonth(start.getMonth() - 1)
      break
    case "3m":
      start.setMonth(start.getMonth() - 3)
      break
    case "6m":
      start.setMonth(start.getMonth() - 6)
      break
    case "1y":
      start.setFullYear(start.getFullYear() - 1)
      break
    case "all":
      return new Date(Date.UTC(2000, 0, 1))
    default:
      start.setFullYear(start.getFullYear() - 1)
      break
  }

  return start
}

export function toDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function todayUtc(): Date {
  const n = new Date()
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))
}

/**
 * Ensure today has a holding snapshot by copying from current FinanceInvestmentHolding
 * (Plaid) and from current balance of SimpleFIN investment accounts.
 * This guarantees at least one data point exists without waiting for the next sync.
 */
export async function ensureTodaySnapshot(userId: string): Promise<void> {
  const today = todayUtc()

  const existingCount = await db.financeInvestmentHoldingSnapshot.count({
    where: { userId, date: today },
  })
  if (existingCount > 0) return

  // Plaid holdings -> snapshots
  const holdings = await db.financeInvestmentHolding.findMany({
    where: { userId },
    select: {
      accountId: true,
      securityId: true,
      quantity: true,
      institutionPrice: true,
      institutionValue: true,
      costBasis: true,
    },
  })

  const snapshotData: Array<{
    userId: string; accountId: string; securityId: string | null;
    date: Date; quantity: number | null; institutionPrice: number | null;
    institutionValue: number | null; costBasis: number | null;
  }> = holdings.map((h) => ({
    userId,
    accountId: h.accountId,
    securityId: h.securityId,
    date: today,
    quantity: h.quantity,
    institutionPrice: h.institutionPrice,
    institutionValue: h.institutionValue,
    costBasis: h.costBasis,
  }))

  // SimpleFIN/manual investment accounts without holdings -> balance snapshots
  const holdingAccountIds = new Set(holdings.map((h) => h.accountId))
  const investmentAccounts = await db.financeAccount.findMany({
    where: {
      userId,
      type: { in: ["investment", "brokerage"] },
      currentBalance: { gt: 0 },
      id: { notIn: [...holdingAccountIds] },
    },
    select: { id: true, currentBalance: true },
  })

  for (const acct of investmentAccounts) {
    snapshotData.push({
      userId,
      accountId: acct.id,
      securityId: `balance_${acct.id}`,
      date: today,
      quantity: 1,
      institutionPrice: acct.currentBalance,
      institutionValue: acct.currentBalance,
      costBasis: null,
    })
  }

  if (snapshotData.length === 0) return

  await db.financeInvestmentHoldingSnapshot.createMany({
    data: snapshotData,
    skipDuplicates: true,
  })
}

/** Detect the cause of a large day-over-day swing between two sets of account IDs */
export function detectSwingAnnotation(
  totalValue: number,
  prevValue: number,
  accountIds: Set<string>,
  prevAccountIds: Set<string>,
): string | undefined {
  if (prevValue <= 0) return undefined
  const changePct = Math.abs(totalValue - prevValue) / prevValue
  if (changePct <= 0.15) return undefined

  const added = [...accountIds].filter((id) => !prevAccountIds.has(id))
  const removed = [...prevAccountIds].filter((id) => !accountIds.has(id))

  if (added.length > 0 && removed.length === 0) {
    return added.length === 1 ? "Account added" : `${added.length} accounts added`
  }
  if (removed.length > 0 && added.length === 0) {
    return removed.length === 1 ? "Account removed" : `${removed.length} accounts removed`
  }
  if (added.length > 0 && removed.length > 0) {
    return `${added.length} added, ${removed.length} removed`
  }
  const pctStr = `${(changePct * 100).toFixed(0)}%`
  return totalValue > prevValue ? `+${pctStr} change` : `-${pctStr} change`
}
