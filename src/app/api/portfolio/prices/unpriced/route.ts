import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** GET /api/portfolio/prices/unpriced — list tokens with unpriced transactions */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9310", "Authentication required", 401)

  try {
    // Find all unique (chain, asset, symbol) combos that have null usdValue
    const unpriced = await db.transactionCache.groupBy({
      by: ["chain", "asset", "symbol"],
      where: { userId: user.id, usdValue: null, value: { not: null } },
      _count: true,
      _sum: { value: true },
    })

    // Also check which ones already have manual prices set
    const manualPrices = await db.manualPrice.findMany({
      where: { userId: user.id },
    })
    const manualSet = new Set(manualPrices.map((m) => `${m.chain}:${m.asset}`))

    const tokens = unpriced.map((row) => ({
      chain: row.chain,
      asset: row.asset ?? "native",
      symbol: row.symbol ?? "UNKNOWN",
      unpricedCount: row._count,
      totalValue: row._sum.value ?? 0,
      hasManualPrice: manualSet.has(`${row.chain}:${row.asset ?? "native"}`),
    }))

    // Sort by count descending (most unpriced first)
    tokens.sort((a, b) => b.unpricedCount - a.unpricedCount)

    return NextResponse.json({
      tokens,
      totalUnpriced: tokens.reduce((sum, t) => sum + t.unpricedCount, 0),
    })
  } catch (error) {
    return apiError("E9311", "Failed to fetch unpriced tokens", 500, error)
  }
}
