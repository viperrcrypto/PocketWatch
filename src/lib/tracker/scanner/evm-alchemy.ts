// EVM scanner using Alchemy's alchemy_getAssetTransfers API.

import type { TrackerChain, NewTransaction, ScanResult, TransactionType } from "../types"
import { CHAIN_CONFIGS, ALCHEMY_CHAIN_SLUGS } from "../chains"
import { getDexName } from "./evm-etherscan"

interface AlchemyTransfer {
  blockNum: string
  hash: string
  from: string
  to: string
  value: number | null
  asset: string | null
  category: string // "external" | "erc20" | "erc721" | "internal"
  rawContract: {
    value: string | null
    address: string | null
    decimal: string | null
  }
  metadata?: {
    blockTimestamp: string // ISO 8601 timestamp
  }
}

/**
 * Scan EVM wallet using Alchemy's alchemy_getAssetTransfers API.
 * Uses user-provided key, falling back to NEXT_PUBLIC_ALCHEMY_API_KEY env var.
 */
export async function scanEvmWalletAlchemy(
  address: string,
  chain: TrackerChain,
  fromBlock?: bigint,
  userAlchemyKey?: string
): Promise<ScanResult> {
  const alchemyKey = userAlchemyKey || process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  if (!alchemyKey) throw new Error("No Alchemy API key available")

  const chainSlug = ALCHEMY_CHAIN_SLUGS[chain]
  if (!chainSlug) throw new Error(`Alchemy not supported for ${chain}`)

  const baseUrl = `https://${chainSlug}.g.alchemy.com/v2/${alchemyKey}`
  const transactions: NewTransaction[] = []
  let maxBlock = fromBlock ?? 0n

  // Fetch outgoing transfers
  const fromBlockHex = fromBlock ? `0x${(fromBlock + 1n).toString(16)}` : "0x0"

  const config = CHAIN_CONFIGS[chain]
  const nativeSymbol = config.nativeToken
  const wallet = address.toLowerCase()

  // Collect all transfers (both directions)
  const allTransfers: AlchemyTransfer[] = []

  for (const direction of ["from", "to"] as const) {
    const params: Record<string, unknown> = {
      category: ["external", "erc20"],
      maxCount: "0x64", // 100
      order: "desc",
    }
    if (direction === "from") {
      params.fromAddress = address
    } else {
      params.toAddress = address
    }
    if (fromBlock) {
      params.fromBlock = fromBlockHex
    }

    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [params],
      }),
    })

    if (!res.ok) throw new Error(`Alchemy API error: ${res.status}`)
    const data = await res.json()
    if (data.error) throw new Error(`Alchemy error: ${data.error.message}`)

    const transfers: AlchemyTransfer[] = data.result?.transfers ?? []
    allTransfers.push(...transfers)
  }

  // Group transfers by txHash to detect swaps
  const byHash = new Map<string, AlchemyTransfer[]>()
  // Build timestamp lookup from Alchemy metadata (hash → Date)
  const timestampByHash = new Map<string, Date>()
  for (const t of allTransfers) {
    const hash = t.hash.toLowerCase()
    if (!byHash.has(hash)) byHash.set(hash, [])
    byHash.get(hash)!.push(t)
    const blockNum = BigInt(t.blockNum)
    if (blockNum > maxBlock) maxBlock = blockNum
    // Extract actual block timestamp from Alchemy metadata
    if (t.metadata?.blockTimestamp && !timestampByHash.has(hash)) {
      timestampByHash.set(hash, new Date(t.metadata.blockTimestamp))
    }
  }

  // Helper to resolve block timestamp (fallback to current time only as last resort)
  const getBlockTimestamp = (hash: string): Date => timestampByHash.get(hash) ?? new Date()

  for (const [hash, transfers] of byHash) {
    const blockNum = BigInt(transfers[0].blockNum)

    // Separate by direction and type
    const incomingTokens = transfers.filter((t) => t.to.toLowerCase() === wallet && t.category === "erc20")
    const outgoingTokens = transfers.filter((t) => t.from.toLowerCase() === wallet && t.category === "erc20")
    const incomingNative = transfers.filter((t) => t.to.toLowerCase() === wallet && t.category === "external")
    const outgoingNative = transfers.filter((t) => t.from.toLowerCase() === wallet && t.category === "external")

    const dexName = transfers.reduce<string | undefined>((d, t) => {
      return d ?? getDexName(t.to.toLowerCase(), chain) ?? getDexName(t.from.toLowerCase(), chain)
    }, undefined)

    // Case 1: Token-to-token swap
    if (incomingTokens.length > 0 && outgoingTokens.length > 0) {
      const inT = incomingTokens[0]
      const outT = outgoingTokens[0]
      const inDecimals = inT.rawContract.decimal ? parseInt(inT.rawContract.decimal, 16) : 18
      const outDecimals = outT.rawContract.decimal ? parseInt(outT.rawContract.decimal, 16) : 18

      transactions.push({
        txHash: hash, chain, type: "SWAP", blockNumber: blockNum, blockTimestamp: getBlockTimestamp(hash),
        tokenInAddress: outT.rawContract.address?.toLowerCase(),
        tokenInSymbol: outT.asset ?? undefined,
        tokenInAmount: outT.value ?? undefined,
        tokenOutAddress: inT.rawContract.address?.toLowerCase(),
        tokenOutSymbol: inT.asset ?? undefined,
        tokenOutAmount: inT.value ?? undefined,
        tokenAddress: inT.rawContract.address?.toLowerCase(),
        tokenSymbol: inT.asset ?? undefined,
        tokenDecimals: inDecimals,
        amountFormatted: inT.value ?? undefined,
        fromAddress: outT.from.toLowerCase(),
        toAddress: inT.to.toLowerCase(),
        dexName,
      })
      continue
    }

    // Case 2: BUY — native out, token in
    if (incomingTokens.length > 0 && outgoingNative.length > 0) {
      const inT = incomingTokens[0]
      const inDecimals = inT.rawContract.decimal ? parseInt(inT.rawContract.decimal, 16) : 18

      transactions.push({
        txHash: hash, chain, type: "BUY", blockNumber: blockNum, blockTimestamp: getBlockTimestamp(hash),
        tokenInSymbol: nativeSymbol,
        tokenInAmount: outgoingNative[0].value ?? undefined,
        tokenOutAddress: inT.rawContract.address?.toLowerCase(),
        tokenOutSymbol: inT.asset ?? undefined,
        tokenOutAmount: inT.value ?? undefined,
        tokenAddress: inT.rawContract.address?.toLowerCase(),
        tokenSymbol: inT.asset ?? undefined,
        tokenDecimals: inDecimals,
        amountFormatted: inT.value ?? undefined,
        fromAddress: wallet,
        toAddress: inT.from.toLowerCase(),
        dexName,
      })
      continue
    }

    // Case 3: SELL — token out, native in
    if (outgoingTokens.length > 0 && (incomingNative.length > 0 || dexName)) {
      const outT = outgoingTokens[0]
      const outDecimals = outT.rawContract.decimal ? parseInt(outT.rawContract.decimal, 16) : 18

      transactions.push({
        txHash: hash, chain, type: "SELL", blockNumber: blockNum, blockTimestamp: getBlockTimestamp(hash),
        tokenInAddress: outT.rawContract.address?.toLowerCase(),
        tokenInSymbol: outT.asset ?? undefined,
        tokenInAmount: outT.value ?? undefined,
        tokenOutSymbol: nativeSymbol,
        tokenOutAmount: incomingNative[0]?.value ?? undefined,
        tokenAddress: outT.rawContract.address?.toLowerCase(),
        tokenSymbol: outT.asset ?? undefined,
        tokenDecimals: outDecimals,
        amountFormatted: outT.value ?? undefined,
        fromAddress: outT.from.toLowerCase(),
        toAddress: outT.to.toLowerCase(),
        dexName,
      })
      continue
    }

    // Case 4: Simple transfers — no swap correlation
    for (const t of transfers) {
      const isIncoming = t.to.toLowerCase() === wallet
      const isErc20 = t.category === "erc20"
      const decimals = t.rawContract.decimal ? parseInt(t.rawContract.decimal, 16) : 18

      let type: TransactionType
      if (isErc20) {
        type = isIncoming ? "TRANSFER_IN" : "TRANSFER_OUT"
      } else {
        type = isIncoming ? "TRANSFER_IN" : "TRANSFER_OUT"
      }

      transactions.push({
        txHash: t.hash, chain, type,
        blockNumber: BigInt(t.blockNum),
        blockTimestamp: getBlockTimestamp(t.hash.toLowerCase()),
        tokenAddress: isErc20 ? t.rawContract.address?.toLowerCase() : undefined,
        tokenSymbol: t.asset ?? undefined,
        tokenDecimals: decimals,
        amountRaw: t.rawContract.value ?? undefined,
        amountFormatted: t.value ?? undefined,
        fromAddress: t.from.toLowerCase(),
        toAddress: t.to.toLowerCase(),
        dexName: getDexName(t.to.toLowerCase(), chain) ?? getDexName(t.from.toLowerCase(), chain),
      })
    }
  }

  return {
    transactions,
    lastBlock: maxBlock > 0n ? maxBlock : undefined,
  }
}
