import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** GET /api/portfolio/analytics/gains — Realized gains history */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9230", "Authentication required", 401)

  const sp = request.nextUrl.searchParams
  const walletsParam = sp.getAll("wallets[]")
  const assetsParam = sp.getAll("assets[]")
  const fromDate = sp.get("from")
  const toDate = sp.get("to")
  const taxYear = sp.get("taxYear") // e.g. "2025" — takes precedence over from/to
  const limit = parseInt(sp.get("limit") ?? "100", 10)
  const offset = parseInt(sp.get("offset") ?? "0", 10)

  try {
    const where: Record<string, unknown> = { userId: user.id }
    if (walletsParam.length > 0) where.walletAddress = { in: walletsParam }
    if (assetsParam.length > 0) where.asset = { in: assetsParam }

    // taxYear takes precedence over from/to
    if (taxYear && /^\d{4}$/.test(taxYear)) {
      const year = parseInt(taxYear, 10)
      where.disposedAt = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      }
    } else if (fromDate || toDate) {
      const dateFilter: Record<string, Date> = {}
      if (fromDate) dateFilter.gte = new Date(fromDate)
      if (toDate) dateFilter.lte = new Date(toDate + "T23:59:59Z")
      where.disposedAt = dateFilter
    }

    const [gains, total] = await Promise.all([
      db.realizedGain.findMany({
        where,
        orderBy: { disposedAt: "desc" },
        take: Math.min(limit, 500),
        skip: offset,
      }),
      db.realizedGain.count({ where }),
    ])

    const entries = gains.map((g) => ({
      id: g.id,
      asset: g.asset,
      symbol: g.symbol,
      disposedAt: g.disposedAt,
      quantity: g.quantity,
      proceedsUsd: g.proceedsUsd,
      costBasisUsd: g.costBasisUsd,
      gainUsd: g.gainUsd,
      holdingPeriod: g.holdingPeriod,
      isLongTerm: g.holdingPeriod >= 365,
      walletAddress: g.walletAddress,
      txHash: g.txHash,
      acquiredAt: g.acquiredAt,
      acquiredAtVarious: g.acquiredAtVarious,
      costBasisMethod: g.costBasisMethod,
      form8949Box: g.form8949Box,
    }))

    // Cumulative gain series for chart (scoped to same filter)
    const allGains = await db.realizedGain.findMany({
      where,
      orderBy: { disposedAt: "asc" },
      select: { disposedAt: true, gainUsd: true },
      take: 2000, // cap chart series to prevent OOM on large datasets
    })

    // Build cumulative series, deduplicating by second (lightweight-charts
    // requires strictly ascending time values).
    let cumulative = 0
    const seriesMap = new Map<number, number>()
    for (const g of allGains) {
      cumulative += g.gainUsd
      const timeSec = Math.floor(g.disposedAt.getTime() / 1000)
      seriesMap.set(timeSec, cumulative)
    }
    const cumulativeSeries = Array.from(seriesMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([time, value]) => ({ time, value }))

    return NextResponse.json({
      entries,
      total,
      limit,
      offset,
      cumulativeSeries,
    })
  } catch (error) {
    return apiError("E9231", "Failed to fetch realized gains", 500, error)
  }
}
