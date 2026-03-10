/**
 * Row-to-entry mappers for on-chain and exchange history entries.
 */

import { getChainMeta } from "@/lib/portfolio/chains"

// ─── Types (re-used from event-history) ──────────────────────────

export interface UnifiedHistoryEntry {
  timestamp: number
  event_type: string
  classification: string | null
  asset: string
  amount: number
  usd_value: number | null
  address: string | null
  counterparty: string | null
  tx_hash: string | null
  block_number: number | null
  chain: string | null
  contract_address: string | null
  token_name: string | null
  direction: string | null
  source: "onchain" | "exchange"
  explorer_url: string | null
  isFlagged: boolean
  isWhitelisted: boolean
  exchangeId?: string
  exchangeLabel?: string
  exchangeStatus?: string
  network?: string | null
  grouped_transfers?: Array<{
    asset: string
    amount: number
    usd_value: number | null
    direction: string | null
    classification: string | null
  }>
}

// ─── Shared helpers ──────────────────────────────────────────────

export function buildExplorerUrl(chain: string | null, txHash: string | null): string | null {
  if (!chain || !txHash) return null
  const meta = getChainMeta(chain)
  if (!meta?.explorerUrl) return null
  return `${meta.explorerUrl}/tx/${txHash}`
}

function parseTradeSideFromRaw(raw: unknown): "buy" | "sell" | null {
  if (!raw || typeof raw !== "object") return null
  const value = (raw as Record<string, unknown>).side
  if (typeof value !== "string") return null
  const normalized = value.toLowerCase()
  return normalized === "buy" || normalized === "sell" ? normalized : null
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  internal_transfer: "deposit",
  swap: "swap",
  inflow: "receive",
  outflow: "send",
  yield: "reward",
  gas: "gas",
  spam: "spam",
}

function classifyFromCache(direction: string, txClassification?: string | null): string {
  if (txClassification && CLASSIFICATION_LABELS[txClassification]) {
    return CLASSIFICATION_LABELS[txClassification]
  }
  return direction === "in" ? "receive" : "send"
}

// ─── On-chain entry mapper ───────────────────────────────────────

export function mapOnchainRows(rows: Array<{
  blockTimestamp: number
  direction: string
  txClassification: string | null
  symbol: string | null
  asset: string | null
  value: number | null
  usdValue: number | null
  walletAddress: string
  from: string | null
  to: string | null
  txHash: string
  blockNumber: number | null
  chain: string
  isFlagged: boolean | null
  isWhitelisted: boolean | null
}>): UnifiedHistoryEntry[] {
  const rowsByHash = new Map<string, typeof rows>()
  for (const row of rows) {
    const existing = rowsByHash.get(row.txHash) ?? []
    existing.push(row)
    rowsByHash.set(row.txHash, existing)
  }

  // Deduplicate grouped_transfers: collapse same (asset, direction) pairs
  // to eliminate intermediate DEX-routing duplicates.
  // Gas rows are kept as-is (not deduped with transfer rows).
  function dedupeTransfers(siblings: typeof rows) {
    const gasRows: Array<{ asset: string; amount: number; usd_value: number | null; direction: string; classification: string | null }> = []
    const seen = new Map<string, { asset: string; amount: number; usd_value: number | null; direction: string; classification: string | null }>()
    for (const s of siblings) {
      const asset = s.symbol ?? s.asset ?? "ETH"
      const classification = s.txClassification ?? null
      if (classification === "gas") {
        gasRows.push({ asset, amount: s.value ?? 0, usd_value: s.usdValue ?? null, direction: s.direction, classification })
        continue
      }
      const key = `${asset}:${s.direction}`
      const existing = seen.get(key)
      if (!existing || Math.abs(s.value ?? 0) > Math.abs(existing.amount)) {
        seen.set(key, { asset, amount: s.value ?? 0, usd_value: s.usdValue ?? null, direction: s.direction, classification })
      }
    }
    return [...seen.values(), ...gasRows]
  }

  // For swap txHashes, track which we've already emitted so we show one row per swap
  const emittedSwapHashes = new Set<string>()

  const entries: UnifiedHistoryEntry[] = []
  for (const row of rows) {
    const siblings = rowsByHash.get(row.txHash) ?? []

    // Gas rows with sibling transfers are folded into grouped_transfers — don't show standalone
    if (row.txClassification === "gas" && siblings.some((s) => s.txClassification !== "gas")) continue

    const isSwap = siblings.length > 1 && siblings.some((s) => s.txClassification === "swap")

    // For swaps, emit only one row per txHash — pick the primary "in" transfer
    if (isSwap) {
      if (emittedSwapHashes.has(row.txHash)) continue
      emittedSwapHashes.add(row.txHash)

      // Pick the best representative row: prefer "in" direction with highest USD value
      const inRows = siblings.filter((s) => s.direction === "in" && s.txClassification !== "gas")
      const representative = inRows.length > 0
        ? inRows.reduce((best, s) => (Math.abs(s.usdValue ?? 0) > Math.abs(best.usdValue ?? 0) ? s : best))
        : row
      const deduped = dedupeTransfers(siblings)

      entries.push({
        timestamp: representative.blockTimestamp,
        event_type: classifyFromCache(representative.direction, representative.txClassification),
        classification: representative.txClassification ?? null,
        asset: representative.symbol ?? representative.asset ?? "ETH",
        amount: representative.value ?? 0,
        usd_value: representative.usdValue ?? null,
        address: representative.walletAddress,
        counterparty: representative.direction === "in" ? representative.from : (representative.to ?? null),
        tx_hash: representative.txHash,
        block_number: representative.blockNumber,
        chain: representative.chain,
        contract_address: representative.asset !== "native" ? (representative.asset ?? null) : null,
        token_name: representative.symbol ?? null,
        direction: representative.direction,
        source: "onchain" as const,
        explorer_url: buildExplorerUrl(representative.chain, representative.txHash),
        isFlagged: representative.isFlagged ?? false,
        isWhitelisted: representative.isWhitelisted ?? false,
        grouped_transfers: deduped,
      })
      continue
    }

    const groupedTransfers = siblings.length > 1
      ? siblings.map((s) => ({
          asset: s.symbol ?? s.asset ?? "ETH",
          amount: s.value ?? 0,
          usd_value: s.usdValue ?? null,
          direction: s.direction,
          classification: s.txClassification ?? null,
        }))
      : undefined

    entries.push({
      timestamp: row.blockTimestamp,
      event_type: classifyFromCache(row.direction, row.txClassification),
      classification: row.txClassification ?? null,
      asset: row.symbol ?? row.asset ?? "ETH",
      amount: row.value ?? 0,
      usd_value: row.usdValue ?? null,
      address: row.walletAddress,
      counterparty: row.direction === "in" ? row.from : (row.to ?? null),
      tx_hash: row.txHash,
      block_number: row.blockNumber,
      chain: row.chain,
      contract_address: row.asset !== "native" ? (row.asset ?? null) : null,
      token_name: row.symbol ?? null,
      direction: row.direction,
      source: "onchain" as const,
      explorer_url: buildExplorerUrl(row.chain, row.txHash),
      isFlagged: row.isFlagged ?? false,
      isWhitelisted: row.isWhitelisted ?? false,
      grouped_transfers: groupedTransfers,
    })
  }

  return entries
}

// ─── Exchange entry mapper ───────────────────────────────────────

export function mapExchangeRows(rows: Array<{
  timestamp: number
  type: string
  currency: string
  amount: number
  usdValue: number | null
  address: string | null
  exchangeLabel: string
  txid: string | null
  exchangeId: string
  status: string
  network: string | null
  raw: unknown
}>): UnifiedHistoryEntry[] {
  return rows.map((row) => {
    const tradeSide = row.type === "trade" ? parseTradeSideFromRaw(row.raw) : null
    return {
      timestamp: row.timestamp,
      event_type: row.type,
      classification: null,
      asset: row.currency,
      amount: row.amount,
      usd_value: row.usdValue ?? null,
      address: row.address,
      counterparty: row.exchangeLabel,
      tx_hash: row.txid,
      block_number: null,
      chain: null,
      contract_address: null,
      token_name: row.currency,
      direction: row.type === "deposit"
        ? "in"
        : row.type === "withdrawal"
          ? "out"
          : tradeSide === "buy"
            ? "in"
            : tradeSide === "sell"
              ? "out"
              : null,
      source: "exchange" as const,
      explorer_url: row.network ? buildExplorerUrl(row.network, row.txid) : null,
      isFlagged: false,
      isWhitelisted: false,
      exchangeId: row.exchangeId,
      exchangeLabel: row.exchangeLabel,
      exchangeStatus: row.status,
      network: row.network,
    }
  })
}
