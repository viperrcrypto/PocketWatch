import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"

type RangeKey = "1w" | "1m" | "3m" | "6m" | "1y" | "all"

function rangeToDate(range: string): Date {
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

function toDateKey(date: Date): string {
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
 * Ensure today has a holding snapshot by copying from current FinanceInvestmentHolding.
 * This guarantees at least one data point exists without waiting for the next Plaid sync.
 */
async function ensureTodaySnapshot(userId: string): Promise<void> {
  const today = todayUtc()

  const existingCount = await db.financeInvestmentHoldingSnapshot.count({
    where: { userId, date: today },
  })
  if (existingCount > 0) return

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

  if (holdings.length === 0) return

  await db.financeInvestmentHoldingSnapshot.createMany({
    data: holdings.map((h) => ({
      userId,
      accountId: h.accountId,
      securityId: h.securityId,
      date: today,
      quantity: h.quantity,
      institutionPrice: h.institutionPrice,
      institutionValue: h.institutionValue,
      costBasis: h.costBasis,
    })),
    skipDuplicates: true,
  })
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9010", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const range = searchParams.get("range") ?? "1y"

  try {
    // Seed today's snapshot from current holdings if it doesn't exist
    await ensureTodaySnapshot(user.id)

    const startDate = rangeToDate(range)

    // Get all holding snapshots in date range
    const snapshots = await db.financeInvestmentHoldingSnapshot.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        institutionValue: true,
        costBasis: true,
      },
    })

    if (snapshots.length === 0) {
      return NextResponse.json({ entries: [], source: "none" })
    }

    // Aggregate by date: sum all holding values per day
    const byDate = new Map<string, { totalValue: number; totalCostBasis: number }>()
    for (const snap of snapshots) {
      const key = toDateKey(snap.date)
      const existing = byDate.get(key) ?? { totalValue: 0, totalCostBasis: 0 }
      byDate.set(key, {
        totalValue: existing.totalValue + (snap.institutionValue ?? 0),
        totalCostBasis: existing.totalCostBasis + (snap.costBasis ?? 0),
      })
    }

    const entries = Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { totalValue, totalCostBasis }]) => ({
        date,
        totalValue,
        totalCostBasis,
        gainLoss: totalValue - totalCostBasis,
      }))

    return NextResponse.json({ entries, source: "holdings_snapshots" })
  } catch (err) {
    return apiError("F9011", "Failed to fetch investment history", 500, err)
  }
}
