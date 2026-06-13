/**
 * Lightweight portfolio-balances reader for non-HTTP callers (e.g. the PocketLLM
 * chat tools). Mirrors the data sources of GET /api/portfolio/balances —
 * tracked wallets via the multi-provider cache + exchange balances — and
 * aggregates positions with hidden-token filtering, WITHOUT the route's
 * snapshot-writing side effects or in-memory response cache.
 *
 * All reads are scoped by userId. Numeric values stay as raw numbers.
 */

import { db } from "@/lib/db"
import { getCachedMultiProviderPositions } from "./multi-balance-cache"
import { getAllExchangeCredentials } from "./service-keys"
import { fetchAllExchangeBalances } from "./exchange-client"
import { getHiddenTokenSymbols } from "./hidden-tokens"

export interface BalancePosition {
  symbol: string
  name: string
  chain: string
  positionType: string
  protocol: string | null
  quantity: number
  value: number
}

export interface BalancesReadResult {
  error?: string
  message?: string
  positions: BalancePosition[]
  totalValue: number
  onchainTotalValue: number
  exchangeTotalValue: number
  chainDistribution: Record<string, number>
}

/** Build a compact, side-effect-free portfolio balances snapshot for a user. */
export async function buildBalancesForUser(userId: string): Promise<BalancesReadResult> {
  const [wallets, exchangeCreds] = await Promise.all([
    db.trackedWallet.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { address: true, chains: true },
    }),
    getAllExchangeCredentials(userId),
  ])

  if (wallets.length === 0 && exchangeCreds.length === 0) {
    return {
      error: "no_wallets",
      message: "No wallets or exchanges configured. Add them in Portfolio Settings.",
      positions: [],
      totalValue: 0,
      onchainTotalValue: 0,
      exchangeTotalValue: 0,
      chainDistribution: {},
    }
  }

  const hiddenSymbols = await getHiddenTokenSymbols(userId)

  const [walletData, exchangeData] = await Promise.all([
    fetchWalletPositions(userId, wallets),
    fetchExchangePositions(userId, exchangeCreds),
  ])

  const positions: BalancePosition[] = []
  let onchainTotalValue = 0
  let exchangeTotalValue = 0
  const chainDistribution: Record<string, number> = {}

  for (const w of walletData) {
    for (const p of w.positions) {
      if (hiddenSymbols.has(p.symbol)) continue
      positions.push({
        symbol: p.symbol,
        name: p.name,
        chain: p.chain,
        positionType: p.positionType,
        protocol: p.protocol,
        quantity: p.quantity,
        value: p.value,
      })
      onchainTotalValue += p.value
      chainDistribution[p.chain] = (chainDistribution[p.chain] ?? 0) + p.value
    }
  }

  for (const b of exchangeData) {
    if (hiddenSymbols.has(b.asset)) continue
    positions.push({
      symbol: b.asset,
      name: b.asset,
      chain: "exchange",
      positionType: "exchange",
      protocol: null,
      quantity: b.amount,
      value: b.usd_value,
    })
    exchangeTotalValue += b.usd_value
    chainDistribution.exchange = (chainDistribution.exchange ?? 0) + b.usd_value
  }

  return {
    positions,
    totalValue: onchainTotalValue + exchangeTotalValue,
    onchainTotalValue,
    exchangeTotalValue,
    chainDistribution,
  }
}

interface WalletRow {
  address: string
  chains: string[]
}

async function fetchWalletPositions(userId: string, wallets: WalletRow[]) {
  if (wallets.length === 0) return []
  try {
    const { wallets: walletList } = await getCachedMultiProviderPositions(
      userId,
      wallets.map((w) => ({ address: w.address, chains: w.chains })),
    )
    return walletList
  } catch (err) {
    console.warn("[balances-read] Multi-provider fetch failed:", err)
    return []
  }
}

async function fetchExchangePositions(
  userId: string,
  exchangeCreds: Awaited<ReturnType<typeof getAllExchangeCredentials>>,
) {
  if (exchangeCreds.length === 0) return []
  try {
    const result = await fetchAllExchangeBalances(exchangeCreds, userId)
    return result.balances
  } catch (err) {
    console.warn("[balances-read] Exchange fetch failed:", err)
    return []
  }
}
