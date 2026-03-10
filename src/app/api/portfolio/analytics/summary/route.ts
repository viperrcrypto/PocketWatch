import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { isLikelySpamTokenSymbol } from "@/lib/portfolio/price-resolver"

/** GET /api/portfolio/analytics/summary — Aggregated cost-basis summary */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9210", "Authentication required", 401)

  const sp = request.nextUrl.searchParams
  const walletsParam = sp.getAll("wallets[]")
  const assetsParam = sp.getAll("assets[]")
  const period = sp.get("period") // e.g. "30d", "90d", "1y", "all"
  const taxYear = sp.get("taxYear") // e.g. "2025" — takes precedence over period

  try {
    // Build where clauses with optional filters
    const baseWhere: Record<string, unknown> = { userId: user.id }
    if (walletsParam.length > 0) baseWhere.walletAddress = { in: walletsParam }
    if (assetsParam.length > 0) baseWhere.asset = { in: assetsParam }

    // Gains filter: taxYear takes precedence over period
    const gainsWhere = { ...baseWhere }
    if (taxYear && /^\d{4}$/.test(taxYear)) {
      const year = parseInt(taxYear, 10)
      gainsWhere.disposedAt = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      }
    } else if (period && period !== "all") {
      const days = parsePeriodDays(period)
      if (days > 0) {
        gainsWhere.disposedAt = { gte: new Date(Date.now() - days * 86400_000) }
      }
    }

    // Period filter for capital flows
    const flowsWhere: Record<string, unknown> = { userId: user.id }
    if (walletsParam.length > 0) flowsWhere.walletAddress = { in: walletsParam }
    if (assetsParam.length > 0) flowsWhere.asset = { in: assetsParam }
    if (taxYear && /^\d{4}$/.test(taxYear)) {
      const year = parseInt(taxYear, 10)
      flowsWhere.timestamp = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      }
    } else if (period && period !== "all") {
      const days = parsePeriodDays(period)
      if (days > 0) {
        flowsWhere.timestamp = { gte: new Date(Date.now() - days * 86400_000) }
      }
    }

    // Use aggregate queries where possible to avoid loading all rows into memory.
    // Gains need findMany for short/long-term split (holdingPeriod filter).
    // Lots need findMany for per-lot cost basis calculation.
    // Capital flows use aggregate for simple sums.
    const [gains, lots, depositAgg, withdrawalAgg, depositCount, withdrawalCount] = await Promise.all([
      db.realizedGain.findMany({
        where: gainsWhere,
        select: { gainUsd: true, proceedsUsd: true, costBasisUsd: true, holdingPeriod: true, walletAddress: true, symbol: true },
      }),
      db.costBasisLot.findMany({
        where: { ...baseWhere, remainingQty: { gt: 0 } },
        select: { remainingQty: true, quantity: true, costBasisUsd: true, walletAddress: true, symbol: true },
        take: 10000, // safety cap to prevent OOM
      }),
      db.capitalFlow.aggregate({
        where: { ...flowsWhere, flowType: "deposit" },
        _sum: { usdValue: true },
      }),
      db.capitalFlow.aggregate({
        where: { ...flowsWhere, flowType: "withdrawal" },
        _sum: { usdValue: true },
      }),
      db.capitalFlow.count({ where: { ...flowsWhere, flowType: "deposit" } }),
      db.capitalFlow.count({ where: { ...flowsWhere, flowType: "withdrawal" } }),
    ])

    // Aggregate realized gains
    const totalRealizedGain = gains.reduce((sum, g) => sum + g.gainUsd, 0)
    const totalProceeds = gains.reduce((sum, g) => sum + g.proceedsUsd, 0)
    const totalRealizedCostBasis = gains.reduce((sum, g) => sum + g.costBasisUsd, 0)

    // Aggregate open lots (unrealized)
    const totalOpenCostBasis = lots.reduce((sum, l) => sum + (l.remainingQty / l.quantity) * l.costBasisUsd, 0)
    const totalOpenQuantity = lots.reduce((sum, l) => sum + l.remainingQty, 0)

    // Aggregate capital flows (from aggregate queries)
    const totalDeposits = depositAgg._sum.usdValue ?? 0
    const totalWithdrawals = withdrawalAgg._sum.usdValue ?? 0
    const netCapitalFlows = totalDeposits - totalWithdrawals

    // Short-term vs long-term (365 day threshold)
    const shortTermGains = gains
      .filter((g) => g.holdingPeriod < 365)
      .reduce((sum, g) => sum + g.gainUsd, 0)
    const longTermGains = gains
      .filter((g) => g.holdingPeriod >= 365)
      .reduce((sum, g) => sum + g.gainUsd, 0)

    // Short-term/long-term proceeds + cost basis for tax summary
    const shortTermProceeds = gains
      .filter((g) => g.holdingPeriod < 365)
      .reduce((sum, g) => sum + g.proceedsUsd, 0)
    const longTermProceeds = gains
      .filter((g) => g.holdingPeriod >= 365)
      .reduce((sum, g) => sum + g.proceedsUsd, 0)
    const shortTermCostBasis = gains
      .filter((g) => g.holdingPeriod < 365)
      .reduce((sum, g) => sum + g.costBasisUsd, 0)
    const longTermCostBasis = gains
      .filter((g) => g.holdingPeriod >= 365)
      .reduce((sum, g) => sum + g.costBasisUsd, 0)

    // Available filters (unique values)
    const uniqueWallets = [...new Set([...gains.map((g) => g.walletAddress), ...lots.map((l) => l.walletAddress)])]
    // Deduplicate assets: filter spam, normalize casing by frequency
    const allSymbols = [...gains.map((g) => g.symbol), ...lots.map((l) => l.symbol)]
      .filter((s): s is string => !!s && !isLikelySpamTokenSymbol(s))
    const symbolFreq = new Map<string, Map<string, number>>()
    for (const s of allSymbols) {
      const upper = s.toUpperCase()
      const casings = symbolFreq.get(upper) ?? new Map<string, number>()
      casings.set(s, (casings.get(s) ?? 0) + 1)
      symbolFreq.set(upper, casings)
    }
    const uniqueAssets = [...symbolFreq.entries()]
      .sort((a, b) => {
        const countA = [...a[1].values()].reduce((x, y) => x + y, 0)
        const countB = [...b[1].values()].reduce((x, y) => x + y, 0)
        return countB - countA
      })
      .map(([, casings]) => {
        let best = ""
        let bestCount = 0
        for (const [casing, count] of casings) {
          if (count > bestCount) { best = casing; bestCount = count }
        }
        return best
      })

    // Available tax years (from all-time gains)
    const allGainsForYears = await db.realizedGain.findMany({
      where: { userId: user.id },
      select: { disposedAt: true },
      orderBy: { disposedAt: "asc" },
    })
    const yearSet = new Set(allGainsForYears.map((g) => g.disposedAt.getUTCFullYear()))
    const availableYears = [...yearSet].sort((a, b) => b - a) // newest first

    // Read user's cost basis method
    const setting = await db.portfolioSetting.findUnique({ where: { userId: user.id } })
    const settingsJson = (setting?.settings as Record<string, unknown>) ?? {}
    const costBasisMethod = (settingsJson.costBasisMethod as string) ?? "FIFO"

    return NextResponse.json({
      realized: {
        totalGain: totalRealizedGain,
        totalProceeds,
        totalCostBasis: totalRealizedCostBasis,
        shortTermGain: shortTermGains,
        longTermGain: longTermGains,
        shortTermProceeds,
        longTermProceeds,
        shortTermCostBasis,
        longTermCostBasis,
        count: gains.length,
      },
      unrealized: {
        totalCostBasis: totalOpenCostBasis,
        openLots: lots.length,
        totalQuantity: totalOpenQuantity,
      },
      capitalFlows: {
        totalDeposits,
        totalWithdrawals,
        net: netCapitalFlows,
        depositCount,
        withdrawalCount,
      },
      filters: {
        wallets: uniqueWallets,
        assets: uniqueAssets,
      },
      availableYears,
      costBasisMethod,
      hasData: gains.length > 0 || lots.length > 0,
    })
  } catch (error) {
    return apiError("E9211", "Failed to fetch analytics summary", 500, error)
  }
}

function parsePeriodDays(period: string): number {
  const match = period.match(/^(\d+)(d|m|y)$/i)
  if (!match) return 0
  const num = parseInt(match[1], 10)
  switch (match[2].toLowerCase()) {
    case "d": return num
    case "m": return num * 30
    case "y": return num * 365
    default: return 0
  }
}
