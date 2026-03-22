import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getCachedMultiProviderPositions } from "@/lib/portfolio/multi-balance-cache"
import { getAllExchangeCredentials } from "@/lib/portfolio/service-keys"
import { fetchAllExchangeBalances } from "@/lib/portfolio/exchange-client"
import { getRefreshMeta, queuePortfolioRefresh, runPortfolioRefreshJob } from "@/lib/portfolio/refresh-orchestrator"
import { normalizeWalletAddress } from "@/lib/portfolio/utils"

export const maxDuration = 60

// Simple in-memory cache per user (survives between requests in same worker)
const cache = new Map<string, { data: object; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60_000 // 5 minutes
const CACHE_MAX_SIZE = 100 // prevent unbounded memory growth in multi-tenant deployments

export function invalidateBalancesResponseCache(userId?: string): void {
  if (userId) { cache.delete(userId); return }
  cache.clear()
}

function cacheSet(userId: string, data: object): void {
  // Evict oldest entries if cache exceeds max size
  if (cache.size >= CACHE_MAX_SIZE) {
    let oldestKey: string | null = null
    let oldestTs = Infinity
    for (const [key, entry] of cache) {
      if (entry.timestamp < oldestTs) {
        oldestTs = entry.timestamp
        oldestKey = key
      }
    }
    if (oldestKey) cache.delete(oldestKey)
  }
  cache.set(userId, { data, timestamp: Date.now() })
}

async function buildBalancesResponse(userId: string): Promise<object> {
  const [wallets, exchangeCreds] = await Promise.all([
    db.trackedWallet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { address: true, chains: true, label: true },
    }),
    getAllExchangeCredentials(userId),
  ])

  // Fetch on-chain + exchange balances in parallel
  const [walletData, exchangeData] = await Promise.all([
    // On-chain via multi-provider (Zerion/Alchemy/Moralis for EVM, Helius/Alchemy for Solana)
    (async () => {
      if (wallets.length === 0) {
        console.warn("[balances] No wallets for user", userId)
        return []
      }
      try {
        console.log(`[balances] Fetching ${wallets.length} wallet(s) for user ${userId}`)
        const { wallets: walletList, failedCount } = await getCachedMultiProviderPositions(
          userId,
          wallets.map((w) => ({ address: w.address, chains: w.chains })),
        )
        console.log(`[balances] Got ${walletList.length} wallet(s) with ${walletList.reduce((s, w) => s + w.positions.length, 0)} total positions — wallets: ${walletList.length}/${wallets.length}${failedCount > 0 ? ` (${failedCount} failed)` : ""}, value: $${walletList.reduce((s, w) => s + w.totalValue, 0).toFixed(2)}`)
        return walletList
      } catch (err) {
        console.error("[balances] Multi-provider fetch failed:", err)
        return null
      }
    })(),
    // Exchange via CCXT
    (async () => {
      if (exchangeCreds.length === 0) return null
      try {
        return await fetchAllExchangeBalances(exchangeCreds, userId)
      } catch (err) {
        console.error("[balances] Exchange fetch failed:", err)
        return null
      }
    })(),
  ])

  // If no wallets and no exchanges, return early
  if (wallets.length === 0 && exchangeCreds.length === 0) {
    return { error: "no_wallets", message: "No wallets or exchanges configured. Add them in Portfolio Settings.", positions: [], totalValue: 0 }
  }

  // If all providers were throttled, try to serve the last cached response
  if (walletData === null && wallets.length > 0) {
    const stale = cache.get(userId)
    if (stale) {
      console.info("[balances] Serving stale cache during Zerion throttle")
      return stale.data
    }
    // No stale cache — fall back to last known snapshot total so at least
    // the headline value is correct even if positions can't be listed
    const lastSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId, source: "live_refresh" },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true, metadata: true },
    })
    if (lastSnapshot) {
      const meta = typeof lastSnapshot.metadata === "string"
        ? JSON.parse(lastSnapshot.metadata) : lastSnapshot.metadata
      console.info(`[balances] Zerion throttled, no cache — using last snapshot $${lastSnapshot.totalValue.toFixed(0)}`)
      return {
        totalValue: lastSnapshot.totalValue,
        net_usd: lastSnapshot.totalValue,
        onchainTotalValue: meta?.onchainTotalValue ?? lastSnapshot.totalValue,
        exchangeTotalValue: meta?.exchangeTotalValue ?? 0,
        positions: [],
        chainDistribution: meta?.chainDistribution ?? {},
        icons: {},
        wallets: wallets.map((w) => ({ address: w.address, totalValue: 0, label: w.label ?? null })),
        isThrottled: true,
      }
    }
  }

  // Aggregate on-chain positions
  const allPositions: Record<string, unknown>[] = []
  let onChainTotal = 0

  if (walletData && walletData.length > 0) {
    for (const w of walletData) {
      for (const p of w.positions) {
        allPositions.push({
          ...p,
          wallet: w.address,
          balance: p.quantity,
        })
      }
    }
    onChainTotal = walletData.reduce((sum, w) => sum + w.totalValue, 0)
  }

  // Merge exchange positions
  let exchangeTotal = 0
  if (exchangeData && exchangeData.balances.length > 0) {
    for (const b of exchangeData.balances) {
      allPositions.push({
        symbol: b.asset,
        name: b.asset,
        chain: "exchange",
        positionType: "exchange",
        value: b.usd_value,
        quantity: b.amount,
        balance: b.amount,
        wallet: `exchange:${b.exchange}`,
        exchange: b.exchange,
        exchangeLabel: b.exchangeLabel,
      })
    }
    exchangeTotal = exchangeData.totalValue
  }

  const totalValue = onChainTotal + exchangeTotal

  // Build chain distribution map: { chainId: usdValue }
  const chainDistribution: Record<string, number> = {}
  for (const p of allPositions) {
    const chain = (p as any).chain as string
    const value = (p as any).value as number
    chainDistribution[chain] = (chainDistribution[chain] || 0) + value
  }

  // Build icon map: { symbol: iconUrl }
  const icons: Record<string, string> = {}
  for (const p of allPositions) {
    const pos = p as any
    if (pos.iconUrl && pos.symbol && !icons[pos.symbol]) {
      icons[pos.symbol] = pos.iconUrl
    }
  }

  // Build DeFi positions summary (LP, staking, lending, etc.)
  const defiPositions = allPositions
    .filter((p: any) => p.isDefi === true)
    .map((p: any) => ({
      symbol: p.symbol,
      name: p.name,
      chain: p.chain,
      positionType: p.positionType,
      protocol: p.protocol,
      protocolIcon: p.protocolIcon,
      value: p.value,
      quantity: p.quantity,
    }))
  const defiTotalValue = defiPositions.reduce((sum: number, p: any) => sum + (p.value ?? 0), 0)

  // Save a portfolio snapshot for the history chart — but ONLY if all tracked
  // wallets returned data. A partial fetch (some wallets failed) would create
  // a snapshot with an artificially low value, poisoning backward propagation.
  const allWalletsReturned = walletData != null && walletData.length === wallets.length
  const exchangeIncluded = exchangeCreds.length === 0 || (
    exchangeData != null
    && exchangeData.exchanges.length === exchangeCreds.length
    && exchangeData.exchanges.every((exchange) => !exchange.error)
  )
  const walletAddresses = wallets.map((wallet) => normalizeWalletAddress(wallet.address)).sort((a, b) => a.localeCompare(b))
  const walletFingerprint = walletAddresses.join("|")

  if (totalValue > 0 && allWalletsReturned && exchangeIncluded) {
    // Write the live snapshot before returning so history/chart reads stay in sync
    // with the refreshed total shown on the dashboard.
    try {
      await db.portfolioSnapshot.create({
        data: {
          userId,
          totalValue,
          walletCount: wallets.length,
          source: "live_refresh",
          metadata: JSON.stringify({
            chainDistribution,
            walletAddresses,
            walletFingerprint,
            onchainTotalValue: onChainTotal,
            exchangeTotalValue: exchangeTotal,
          }),
        },
      })
    } catch (err) {
      console.warn("[balances] Failed to save portfolio snapshot:", err)
    }
  } else if (totalValue > 0 && (!allWalletsReturned || !exchangeIncluded)) {
    console.warn(
      `[balances] Skipping full snapshot: incomplete fetch — ` +
      `wallets: ${walletData?.length ?? 0}/${wallets.length}, ` +
      `exchange: ${exchangeIncluded ? "ok" : "failed"}`
    )
  }

  // When partial fetch occurs, use the last known good snapshot total
  // instead of returning the artificially low partial sum to the dashboard.
  const isPartialFetch = !allWalletsReturned || !exchangeIncluded
  let displayTotal = totalValue
  if (isPartialFetch && totalValue > 0) {
    const lastGoodSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId, source: "live_refresh" },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true },
    })
    if (lastGoodSnapshot && lastGoodSnapshot.totalValue > totalValue * 1.5) {
      displayTotal = lastGoodSnapshot.totalValue
      console.info(`[balances] Partial fetch: using last known good total $${displayTotal.toFixed(0)} instead of partial $${totalValue.toFixed(0)}`)
    }
  }

  // Always save exchange balance when available — builds up history for
  // blending into the "total" chart scope. Saved independently of the
  // full portfolio snapshot so exchange history grows even on partial fetches.
  if (exchangeTotal > 0) {
    try {
      await db.exchangeBalanceSnapshot.create({
        data: { userId, totalValue: exchangeTotal },
      })
    } catch (err) {
      console.warn("[balances] Failed to save exchange balance snapshot:", err)
    }
  }

  // Build wallet list (on-chain + exchange "wallets")
  const walletList = walletData
    ? walletData.map((w) => ({
        address: w.address,
        totalValue: w.totalValue,
        label: wallets.find((ww) => ww.address === w.address)?.label ?? null,
      }))
    : []

  // Add exchange summaries as "wallets" with isExchange flag
  if (exchangeData) {
    for (const ex of exchangeData.exchanges) {
      walletList.push({
        address: `exchange:${ex.id}`,
        totalValue: ex.totalValue,
        label: ex.label,
        isExchange: true,
        exchangeId: ex.id,
      } as any)
    }
  }

  return {
    totalValue: displayTotal,
    net_usd: displayTotal, // alias for backward-compat
    onchainTotalValue: isPartialFetch ? displayTotal - exchangeTotal : onChainTotal,
    exchangeTotalValue: exchangeTotal,
    isPartialFetch,
    positions: allPositions,
    chainDistribution,
    icons,
    wallets: walletList,
    defiSummary: {
      totalValue: defiTotalValue,
      positionCount: defiPositions.length,
      positions: defiPositions,
    },
    ...(exchangeData ? { exchangeSummary: exchangeData.exchanges } : {}),
  }
}

/** GET /api/portfolio/balances — fetch portfolio (cached) */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9040", "Authentication required", 401)

  try {
    // Serve from cache if fresh
    const cached = cache.get(user.id)
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const refreshMeta = await getRefreshMeta(user.id)
      return NextResponse.json({ ...cached.data, meta: { fromCache: true, ...refreshMeta } })
    }

    const data = await buildBalancesResponse(user.id)
    // Only cache responses with actual position data — throttle fallbacks
    // with empty positions should not poison the cache for 5 minutes
    if (!(data as any).isThrottled) {
      cacheSet(user.id, data)
    }
    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({ ...data, meta: { fromCache: false, ...refreshMeta } })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("Invalid") && msg.includes("API key")) {
      return apiError("E9041", "Invalid API key — update it in Portfolio Settings.", 401, error)
    }
    if (msg.includes("rate limit") || msg.includes("429")) {
      return apiError("E9042", msg, 429, error)
    }
    return apiError("E9043", "Failed to fetch portfolio balances", 500, error)
  }
}

/** POST /api/portfolio/balances — force refresh (bust cache) */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9044", "Authentication required", 401)

  try {
    const refresh = await queuePortfolioRefresh(user.id, { reason: "manual_refresh" })

    const cached = cache.get(user.id)
    let data: object
    let fromCache = false

    if (cached) {
      // Have a cached response — return it immediately, run refresh in background
      data = cached.data
      fromCache = true
      if (refresh.queued && refresh.jobId) {
        void runPortfolioRefreshJob(refresh.jobId).catch((error) => {
          console.warn("[balances] Async refresh job failed:", error)
        })
      }
    } else {
      // No cache — build response once. If a refresh job was queued, it will
      // share the same Zerion fetch via zerion-cache deduplication, so we
      // don't fire two separate API calls.
      if (refresh.queued && refresh.jobId) {
        void runPortfolioRefreshJob(refresh.jobId).catch((error) => {
          console.warn("[balances] Async refresh job failed:", error)
        })
      }
      data = await buildBalancesResponse(user.id)
      cacheSet(user.id, data)
    }

    const refreshMeta = await getRefreshMeta(user.id)
    return NextResponse.json({
      ...data,
      refresh,
      meta: {
        fromCache,
        refreshed: false,
        ...refreshMeta,
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error"
    if (msg.includes("Invalid") && msg.includes("API key")) {
      return apiError("E9045", "Invalid API key — update it in Portfolio Settings.", 401, error)
    }
    return apiError("E9046", "Failed to refresh portfolio balances", 500, error)
  }
}
