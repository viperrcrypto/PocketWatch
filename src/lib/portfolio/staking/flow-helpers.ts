import {
  RECEIPT_PROJECTS,
  RECEIPT_SYMBOL_PATTERNS,
  REWARD_CATEGORY_HINTS,
  KNOWN_REWARD_DISTRIBUTORS,
  DUST_USD_THRESHOLD,
  round2,
  getTxChain,
  toAssetKey,
  toSymbolKey,
  walletChainKey,
} from "./constants"
import { buildSymbolAliases } from "./db-queries"
import type {
  LifecyclePositionInput,
  TxContext,
  TxLeg,
  TxAggregate,
  FlowTotals,
} from "./types"

// ─── Position matching helpers ───

export function isInternalSelfTransfer(leg: TxLeg, ownWallets: Set<string>): boolean {
  if (!leg.from || !leg.to) return false
  return ownWallets.has(leg.from.toLowerCase()) && ownWallets.has(leg.to.toLowerCase())
}

export function isReceiptTokenPosition(position: LifecyclePositionInput): boolean {
  const project = (position.defiProject ?? "").toLowerCase()
  if (project && RECEIPT_PROJECTS.has(project)) return true

  const protocol = (position.protocol ?? "").toLowerCase()
  if (protocol.includes("aave") || protocol.includes("pendle") || protocol.includes("etherfi")) return true

  return RECEIPT_SYMBOL_PATTERNS.some((pattern) => pattern.test(position.symbol))
}

export function buildPositionSymbolAliases(position: LifecyclePositionInput): Set<string> {
  return new Set(buildSymbolAliases(position))
}

export function buildKnownRewardDistributorSet(
  position: LifecyclePositionInput,
  txChain: string,
): Set<string> {
  const set = new Set<string>()
  const project = (position.defiProject ?? "").toLowerCase()
  const byProject = project ? KNOWN_REWARD_DISTRIBUTORS[project] : undefined
  if (byProject) {
    const addresses = byProject[txChain] ?? []
    for (const address of addresses) set.add(address.toLowerCase())
  }
  return set
}

export function isRewardCategoryHint(category: string | null): boolean {
  if (!category) return false
  const normalized = category.toLowerCase()
  return REWARD_CATEGORY_HINTS.some((hint) => normalized.includes(hint))
}

export function positionLegMatch(
  leg: TxLeg,
  positionAssets: Set<string>,
  positionSymbols: Set<string>,
): boolean {
  const legAsset = (leg.asset ?? "").toLowerCase()
  const legSymbol = (leg.symbol ?? "").toUpperCase()
  if (positionAssets.size > 0) {
    if (legAsset && positionAssets.has(legAsset)) return true
    if (!legAsset && legSymbol && positionSymbols.has(legSymbol)) return true
    return false
  }
  if (legSymbol && positionSymbols.has(legSymbol)) return true
  return false
}

export function isReceiptLikeSymbol(symbol: string | null): boolean {
  if (!symbol) return false
  return RECEIPT_SYMBOL_PATTERNS.some((pattern) => pattern.test(symbol))
}

// ─── Immutable aggregate helper ───

export function addToAgg(map: Map<string, TxAggregate>, key: string, dir: "in" | "out", usd: number, ts: number): void {
  const prev = map.get(key) ?? { inUsd: 0, outUsd: 0, latestInTs: 0, latestOutTs: 0 }
  const next: TxAggregate = dir === "in"
    ? { ...prev, inUsd: prev.inUsd + usd, latestInTs: Math.max(ts, prev.latestInTs), outUsd: prev.outUsd, latestOutTs: prev.latestOutTs }
    : { ...prev, outUsd: prev.outUsd + usd, latestOutTs: Math.max(ts, prev.latestOutTs), inUsd: prev.inUsd, latestInTs: prev.latestInTs }
  map.set(key, next)
}

// ─── Empty flow factory ───

export function emptyFlow(confidence: "estimated", reason: string): FlowTotals {
  return {
    depositedUsd: 0,
    withdrawnUsd: 0,
    claimedUsd: 0,
    depositedNative: 0,
    withdrawnNative: 0,
    nativeSymbol: null,
    earliestInTs: 0,
    latestInTs: 0,
    latestOutTs: 0,
    confidence,
    confidenceReason: reason,
    reconstructedTxs: 0,
    rolloverTxs: 0,
    rolloverInUsd: 0,
    rolloverOutUsd: 0,
    rolloverSuccessorSymbol: null,
  }
}

// ─── Aggregate fallback ───

export function fallbackAggregateFlow(
  position: LifecyclePositionInput,
  txContext: TxContext,
  reasonPrefix: string,
): FlowTotals {
  const txChain = getTxChain(position.chain)
  if (!txChain) {
    return emptyFlow("estimated", "No transaction flow found for this chain")
  }

  if (position.contractAddress) {
    const byAsset = txContext.byAsset.get(
      toAssetKey(position.wallet, txChain, position.contractAddress),
    )
    if (byAsset && (byAsset.inUsd > 0 || byAsset.outUsd > 0)) {
      return {
        depositedUsd: round2(byAsset.outUsd),
        withdrawnUsd: round2(byAsset.inUsd),
        claimedUsd: 0,
        depositedNative: 0,
        withdrawnNative: 0,
        nativeSymbol: null,
        earliestInTs: 0,
        latestInTs: byAsset.latestInTs,
        latestOutTs: byAsset.latestOutTs,
        confidence: "modeled",
        confidenceReason: `${reasonPrefix}: asset aggregate fallback`,
        reconstructedTxs: 0,
        rolloverTxs: 0,
        rolloverInUsd: 0,
        rolloverOutUsd: 0,
        rolloverSuccessorSymbol: null,
      }
    }
  }

  // Try all symbol aliases to find the best aggregate match
  const allAliases = buildSymbolAliases(position)
  let best: { inUsd: number; outUsd: number; latestInTs: number; latestOutTs: number } | undefined
  let bestVol = 0
  for (const sym of allAliases) {
    const agg = txContext.bySymbol.get(toSymbolKey(position.wallet, txChain, sym))
    if (!agg) continue
    const vol = agg.inUsd + agg.outUsd
    if (vol > bestVol) {
      best = agg
      bestVol = vol
    }
  }

  if (!best) {
    return emptyFlow("estimated", "No transaction flow found for this position")
  }

  return {
    depositedUsd: round2(best.outUsd),
    withdrawnUsd: round2(best.inUsd),
    claimedUsd: 0,
    depositedNative: 0,
    withdrawnNative: 0,
    nativeSymbol: null,
    earliestInTs: 0,
    latestInTs: best.latestInTs,
    latestOutTs: best.latestOutTs,
    confidence: "modeled",
    confidenceReason: `${reasonPrefix}: symbol aggregate fallback`,
    reconstructedTxs: 0,
    rolloverTxs: 0,
    rolloverInUsd: 0,
    rolloverOutUsd: 0,
    rolloverSuccessorSymbol: null,
  }
}
