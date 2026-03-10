/**
 * Aggregates portfolio positions by symbol with per-source breakdown.
 */

export interface AssetSource {
  /** "wallet" or "exchange" */
  type: "wallet" | "exchange"
  /** Wallet address or exchange service name */
  id: string
  /** Optional label (wallet label or exchange display name) */
  label?: string
  /** Chain identifier for on-chain positions */
  chain?: string
  /** Amount of this asset from this source */
  amount: number
  /** USD value from this source */
  usd_value: number
  /** Exchange domain for logo lookup */
  exchangeDomain?: string
}

export interface AggregatedAsset {
  /** Display symbol (e.g. "USDC", "ETH") */
  symbol: string
  /** Total amount across all sources */
  totalAmount: number
  /** Total USD value across all sources */
  totalValue: number
  /** Individual sources holding this asset */
  sources: readonly AssetSource[]
  /** Number of distinct sources (for badge display) */
  sourceCount: number
  /** Original asset ID (CAIP-19 or symbol) from first occurrence */
  assetId: string
  /** Icon URL if available */
  iconUrl?: string
  /** Chain from first occurrence (for icon rendering) */
  chain?: string
}

interface Position {
  symbol?: string
  balance?: number | string
  quantity?: number | string
  value?: number | string
  chain?: string
  wallet?: string
  walletLabel?: string
  exchange?: string
  exchangeLabel?: string
  exchangeDomain?: string
  iconUrl?: string
  assetId?: string
}

/**
 * Aggregate an array of positions into per-symbol groups with source breakdown.
 * Returns a new array sorted by totalValue descending. Zero-value positions are filtered.
 */
export function aggregatePositionsBySymbol(positions: readonly Position[]): readonly AggregatedAsset[] {
  const bySymbol = new Map<string, {
    symbol: string
    totalAmount: number
    totalValue: number
    sources: AssetSource[]
    assetId: string
    iconUrl?: string
    chain?: string
  }>()

  for (const p of positions) {
    if (!p.symbol) continue
    const amt = parseFloat(String(p.balance ?? p.quantity ?? 0)) || 0
    const val = parseFloat(String(p.value ?? 0)) || 0
    if (val <= 0 && amt <= 0) continue

    const existing = bySymbol.get(p.symbol)

    const source: AssetSource = p.exchange
      ? {
          type: "exchange",
          id: p.exchange,
          label: p.exchangeLabel ?? p.exchange,
          amount: amt,
          usd_value: val,
          exchangeDomain: p.exchangeDomain,
        }
      : {
          type: "wallet",
          id: p.wallet ?? "unknown",
          label: p.walletLabel,
          chain: p.chain,
          amount: amt,
          usd_value: val,
        }

    if (existing) {
      existing.totalAmount += amt
      existing.totalValue += val
      existing.sources = [...existing.sources, source]
      // Prefer icon from position with highest value
      if (!existing.iconUrl && p.iconUrl) {
        existing.iconUrl = p.iconUrl
      }
    } else {
      bySymbol.set(p.symbol, {
        symbol: p.symbol,
        totalAmount: amt,
        totalValue: val,
        sources: [source],
        assetId: p.assetId ?? p.symbol,
        iconUrl: p.iconUrl,
        chain: p.chain,
      })
    }
  }

  return Array.from(bySymbol.values())
    .filter((a) => a.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue)
    .map((a) => ({
      symbol: a.symbol,
      totalAmount: a.totalAmount,
      totalValue: a.totalValue,
      sources: a.sources,
      sourceCount: a.sources.length,
      assetId: a.assetId,
      iconUrl: a.iconUrl,
      chain: a.chain,
    }))
}
