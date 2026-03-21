import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import {
  rangeToDate, toDateKey, ensureTodaySnapshot, detectSwingAnnotation,
} from "@/lib/finance/investment-snapshots"
import { NextResponse, type NextRequest } from "next/server"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9010", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const range = searchParams.get("range") ?? "1y"

  try {
    // Seed today's snapshot from current holdings if it doesn't exist
    await ensureTodaySnapshot(user.id)

    const startDate = rangeToDate(range)

    // Fetch valid account IDs so we can exclude orphaned snapshots
    const validAccounts = await db.financeAccount.findMany({
      where: { userId: user.id },
      select: { id: true },
    })
    const validAccountIds = new Set(validAccounts.map((a) => a.id))

    // Get all holding snapshots in date range
    const snapshots = await db.financeInvestmentHoldingSnapshot.findMany({
      where: {
        userId: user.id,
        date: { gte: startDate },
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        accountId: true,
        institutionValue: true,
        costBasis: true,
      },
    })

    // Filter out orphaned snapshots (account was deleted but snapshots remain)
    const liveSnapshots = snapshots.filter((s) => validAccountIds.has(s.accountId))

    if (liveSnapshots.length === 0) {
      return NextResponse.json({ entries: [], source: "none" })
    }

    // Aggregate by date: sum all holding values per day + track account counts
    const byDate = new Map<string, { totalValue: number; totalCostBasis: number; accountIds: Set<string> }>()
    for (const snap of liveSnapshots) {
      const key = toDateKey(snap.date)
      const existing = byDate.get(key) ?? { totalValue: 0, totalCostBasis: 0, accountIds: new Set<string>() }
      existing.totalValue += snap.institutionValue ?? 0
      existing.totalCostBasis += snap.costBasis ?? 0
      existing.accountIds.add(snap.accountId)
      byDate.set(key, existing)
    }

    const sorted = Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b))

    // Build entries with swing annotations
    const entries: Array<{
      date: string; totalValue: number; totalCostBasis: number
      gainLoss: number; annotation?: string
    }> = []

    for (let i = 0; i < sorted.length; i++) {
      const [date, { totalValue, totalCostBasis, accountIds }] = sorted[i]
      const annotation = i > 0
        ? detectSwingAnnotation(totalValue, sorted[i - 1][1].totalValue, accountIds, sorted[i - 1][1].accountIds)
        : undefined

      entries.push({
        date,
        totalValue,
        totalCostBasis,
        gainLoss: totalValue - totalCostBasis,
        ...(annotation ? { annotation } : {}),
      })
    }

    return NextResponse.json({ entries, source: "holdings_snapshots" })
  } catch (err) {
    return apiError("F9011", "Failed to fetch investment history", 500, err)
  }
}
