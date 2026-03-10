import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** GET /api/portfolio/analytics/lots — Open cost-basis lots */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9220", "Authentication required", 401)

  const sp = request.nextUrl.searchParams
  const walletsParam = sp.getAll("wallets[]")
  const assetsParam = sp.getAll("assets[]")

  try {
    const where: Record<string, unknown> = {
      userId: user.id,
      remainingQty: { gt: 0 },
    }
    if (walletsParam.length > 0) where.walletAddress = { in: walletsParam }
    if (assetsParam.length > 0) where.asset = { in: assetsParam }

    const lots = await db.costBasisLot.findMany({
      where,
      orderBy: { acquiredAt: "asc" },
    })

    // Group by asset for summary
    const byAsset = new Map<string, {
      symbol: string
      totalQty: number
      totalCostBasis: number
      lots: typeof lots
    }>()

    for (const lot of lots) {
      const existing = byAsset.get(lot.asset)
      const proportionalCost = (lot.remainingQty / lot.quantity) * lot.costBasisUsd
      if (existing) {
        existing.totalQty += lot.remainingQty
        existing.totalCostBasis += proportionalCost
        existing.lots.push(lot)
      } else {
        byAsset.set(lot.asset, {
          symbol: lot.symbol,
          totalQty: lot.remainingQty,
          totalCostBasis: proportionalCost,
          lots: [lot],
        })
      }
    }

    const grouped = Array.from(byAsset.entries()).map(([asset, data]) => ({
      asset,
      symbol: data.symbol,
      totalQuantity: data.totalQty,
      totalCostBasis: data.totalCostBasis,
      avgCostPerUnit: data.totalQty > 0 ? data.totalCostBasis / data.totalQty : 0,
      lotCount: data.lots.length,
      lots: data.lots.map((l) => ({
        id: l.id,
        acquiredAt: l.acquiredAt,
        quantity: l.quantity,
        remainingQty: l.remainingQty,
        costBasisUsd: l.costBasisUsd,
        costPerUnit: l.quantity > 0 ? l.costBasisUsd / l.quantity : 0,
        walletAddress: l.walletAddress,
        txHash: l.txHash,
        source: l.source,
      })),
    }))

    return NextResponse.json({
      lots: grouped,
      totalLots: lots.length,
      totalAssets: byAsset.size,
    })
  } catch (error) {
    return apiError("E9221", "Failed to fetch cost-basis lots", 500, error)
  }
}
