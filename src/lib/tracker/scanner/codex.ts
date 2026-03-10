// Codex scanner — unified multi-chain scanning with a single API key.

import type { Codex } from "@codex-data/sdk"
import type { TrackerChain, NewTransaction, ScanResult, TransactionType } from "../types"
import { CHAIN_CONFIGS, CODEX_NETWORK_IDS, CODEX_NETWORK_TO_CHAIN } from "../chains"

/**
 * Scan a wallet using Codex's getTokenEventsForMaker query.
 * Works across all chains with a single API key — replaces Etherscan + Helius.
 *
 * @param address - Wallet address
 * @param chain - Chain to scan (maps to Codex networkId)
 * @param codex - Authenticated Codex client instance
 * @param lastTimestamp - Only return events after this timestamp (unix seconds)
 */
export async function scanWalletCodex(
  address: string,
  chain: TrackerChain,
  codex: Codex,
  lastTimestamp?: number
): Promise<ScanResult> {
  const networkId = CODEX_NETWORK_IDS[chain]
  const transactions: NewTransaction[] = []

  let cursor: string | undefined
  let hasMore = true

  // Paginate through all events since lastTimestamp
  while (hasMore) {
    const result = await codex.queries.getTokenEventsForMaker({
      query: {
        maker: address,
        networkId,
        ...(lastTimestamp
          ? { timestamp: { from: lastTimestamp, to: Math.floor(Date.now() / 1000) } }
          : {}),
      },
      cursor,
      limit: 50,
    })

    const connection = result.getTokenEventsForMaker
    if (!connection?.items?.length) break

    for (const event of connection.items) {
      if (!event) continue
      const tx = mapCodexEventToTransaction(event as CodexEvent, address, chain)
      if (tx) transactions.push(tx)
    }

    cursor = connection.cursor ?? undefined
    hasMore = !!cursor && connection.items.length === 50
  }

  // Determine the max block number for cursor tracking
  let maxBlock: bigint | undefined
  for (const tx of transactions) {
    if (tx.blockNumber && (!maxBlock || tx.blockNumber > maxBlock)) {
      maxBlock = tx.blockNumber
    }
  }

  return {
    transactions,
    lastBlock: maxBlock,
    // For Solana, use the last tx hash as signature cursor
    lastSignature: chain === "SOLANA" && transactions.length > 0
      ? transactions[0].txHash
      : undefined,
  }
}

/**
 * Scan a wallet across ALL chains using Codex (no networkId filter).
 * Returns transactions grouped by chain.
 */
export async function scanWalletCodexAllChains(
  address: string,
  codex: Codex,
  lastTimestamp?: number
): Promise<Map<TrackerChain, ScanResult>> {
  const results = new Map<TrackerChain, ScanResult>()
  const transactions: NewTransaction[] = []

  let cursor: string | undefined
  let hasMore = true

  while (hasMore) {
    const result = await codex.queries.getTokenEventsForMaker({
      query: {
        maker: address,
        ...(lastTimestamp
          ? { timestamp: { from: lastTimestamp, to: Math.floor(Date.now() / 1000) } }
          : {}),
      },
      cursor,
      limit: 50,
    })

    const connection = result.getTokenEventsForMaker
    if (!connection?.items?.length) break

    for (const event of connection.items) {
      if (!event) continue
      const chain = CODEX_NETWORK_TO_CHAIN[event.networkId]
      if (!chain) continue

      const tx = mapCodexEventToTransaction(event as CodexEvent, address, chain)
      if (tx) transactions.push(tx)
    }

    cursor = connection.cursor ?? undefined
    hasMore = !!cursor && connection.items.length === 50
  }

  // Group by chain
  for (const tx of transactions) {
    if (!results.has(tx.chain)) {
      results.set(tx.chain, { transactions: [] })
    }
    results.get(tx.chain)!.transactions.push(tx)
  }

  return results
}

interface CodexEvent {
  address: string
  blockNumber: number
  eventDisplayType?: string | null
  eventType: string
  maker?: string | null
  networkId: number
  timestamp: number
  token0Address?: string | null
  token0SwapValueUsd?: string | null
  token0ValueBase?: string | null
  token1Address?: string | null
  token1SwapValueUsd?: string | null
  token1ValueBase?: string | null
  transactionHash: string
  walletLabels?: string[] | null
  baseTokenPrice?: string | null
}

function mapCodexEventToTransaction(
  event: CodexEvent,
  walletAddress: string,
  chain: TrackerChain
): NewTransaction | null {
  // Only process swap events (buys and sells)
  if (event.eventType !== "Swap") return null

  const displayType = event.eventDisplayType // "Buy" | "Sell" | etc.
  let type: TransactionType = "SWAP"

  if (displayType === "Buy") type = "BUY"
  else if (displayType === "Sell") type = "SELL"

  // token0 is the base token (meme coin), token1 is the quote token (WETH/SOL/etc.) in Codex
  // For a Buy: wallet sent token1 (quote) → received token0 (base)
  // For a Sell: wallet sent token0 (base) → received token1 (quote)
  const token0Usd = event.token0SwapValueUsd ? parseFloat(event.token0SwapValueUsd) : undefined
  const token1Usd = event.token1SwapValueUsd ? parseFloat(event.token1SwapValueUsd) : undefined
  const token0Amount = event.token0ValueBase ? parseFloat(event.token0ValueBase) : undefined
  const baseTokenPrice = event.baseTokenPrice ? parseFloat(event.baseTokenPrice) : undefined

  // Primary token is always token0 (the base/meme token being traded)
  const tokenAddress = event.token0Address || undefined
  const valueUsd = token0Usd ?? token1Usd

  // Derive token1 (quote) amount from USD and native price if possible
  const nativeSymbol = CHAIN_CONFIGS[chain].nativeToken
  let token1Amount: number | undefined

  // token1ValueBase isn't in Codex response, so derive from USD / native price
  // This will be resolved later when feed API calls computeSideUsd with nativePrices
  // For now, leave it undefined — the feed will use valueUsd for display

  if (type === "BUY") {
    return {
      txHash: event.transactionHash,
      chain,
      type,
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: new Date(event.timestamp * 1000),
      tokenAddress: tokenAddress?.toLowerCase(),
      amountFormatted: token0Amount,
      valueUsd,
      // BUY: spent quote token (token1) → received base token (token0)
      tokenInAddress: event.token1Address?.toLowerCase(),
      tokenInSymbol: nativeSymbol, // Quote token is typically the native/wrapped token
      tokenInAmount: token1Amount,
      tokenOutAddress: event.token0Address?.toLowerCase(),
      tokenOutSymbol: undefined, // Will be resolved by enrichToken → tokenSymbolMap
      tokenOutAmount: token0Amount,
      fromAddress: walletAddress.toLowerCase(),
      toAddress: event.address?.toLowerCase(),
      priceUsd: baseTokenPrice,
      dexName: undefined,
    }
  } else {
    return {
      txHash: event.transactionHash,
      chain,
      type,
      blockNumber: BigInt(event.blockNumber),
      blockTimestamp: new Date(event.timestamp * 1000),
      tokenAddress: tokenAddress?.toLowerCase(),
      amountFormatted: token0Amount,
      valueUsd,
      // SELL: spent base token (token0) → received quote token (token1)
      tokenInAddress: event.token0Address?.toLowerCase(),
      tokenInSymbol: undefined, // Will be resolved by enrichToken → tokenSymbolMap
      tokenInAmount: token0Amount,
      tokenOutAddress: event.token1Address?.toLowerCase(),
      tokenOutSymbol: nativeSymbol, // Quote token is typically the native/wrapped token
      tokenOutAmount: token1Amount,
      fromAddress: walletAddress.toLowerCase(),
      toAddress: event.address?.toLowerCase(),
      priceUsd: baseTokenPrice,
      dexName: undefined,
    }
  }
}
