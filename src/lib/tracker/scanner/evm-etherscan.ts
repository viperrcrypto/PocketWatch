// EVM scanner using Etherscan-compatible APIs (requires API key).

import type { TrackerChain, NewTransaction, ScanResult, TransactionType } from "../types"
import { CHAIN_CONFIGS, DEX_ROUTERS } from "../chains"

interface EtherscanTx {
  hash: string
  blockNumber: string
  timeStamp: string
  from: string
  to: string
  value: string
  input: string
  isError: string
  methodId: string
  functionName: string
  contractAddress?: string
  tokenName?: string
  tokenSymbol?: string
  tokenDecimal?: string
}

export async function scanEvmWallet(
  address: string,
  chain: TrackerChain,
  apiKey: string,
  lastBlock?: bigint
): Promise<ScanResult> {
  const config = CHAIN_CONFIGS[chain]
  const startBlock = lastBlock ? (lastBlock + 1n).toString() : "0"

  // Fetch normal transactions
  const normalTxs = await fetchEtherscanApi<EtherscanTx[]>(
    config.explorerApiUrl,
    {
      module: "account",
      action: "txlist",
      address,
      startblock: startBlock,
      endblock: "99999999",
      sort: "asc",
      apikey: apiKey,
    }
  )

  // Fetch ERC-20 token transfers
  const tokenTxs = await fetchEtherscanApi<EtherscanTx[]>(
    config.explorerApiUrl,
    {
      module: "account",
      action: "tokentx",
      address,
      startblock: startBlock,
      endblock: "99999999",
      sort: "asc",
      apikey: apiKey,
    }
  )

  let maxBlock = lastBlock ?? 0n
  const wallet = address.toLowerCase()
  const nativeSymbol = config.nativeToken

  // Index normal txs by hash for DEX detection and native value
  const normalByHash = new Map<string, EtherscanTx>()
  for (const tx of normalTxs) {
    if (tx.isError === "1") continue
    normalByHash.set(tx.hash.toLowerCase(), tx)
    const blockNum = BigInt(tx.blockNumber)
    if (blockNum > maxBlock) maxBlock = blockNum
  }

  // Group token transfers by txHash to detect swaps
  const tokensByHash = new Map<string, EtherscanTx[]>()
  for (const tx of tokenTxs) {
    const hash = tx.hash.toLowerCase()
    if (!tokensByHash.has(hash)) tokensByHash.set(hash, [])
    tokensByHash.get(hash)!.push(tx)
    const blockNum = BigInt(tx.blockNumber)
    if (blockNum > maxBlock) maxBlock = blockNum
  }

  const transactions: NewTransaction[] = []
  const processedHashes = new Set<string>()

  // Process token transfer groups — correlate into BUY/SELL/SWAP
  for (const [hash, transfers] of tokensByHash) {
    processedHashes.add(hash)
    const normalTx = normalByHash.get(hash)
    const blockNum = BigInt(transfers[0].blockNumber)
    const timestamp = new Date(Number(transfers[0].timeStamp) * 1000)

    // Separate incoming vs outgoing token transfers
    const incoming = transfers.filter((t) => t.to.toLowerCase() === wallet)
    const outgoing = transfers.filter((t) => t.from.toLowerCase() === wallet)

    // Check for native ETH value from the normal tx
    const nativeValueWei = normalTx ? BigInt(normalTx.value) : 0n
    const nativeValueFormatted = Number(nativeValueWei) / 1e18
    const hasDex = normalTx ? !!(getDexName(normalTx.to.toLowerCase(), chain) || getDexName(normalTx.from?.toLowerCase() ?? "", chain)) : false
    const dexName = normalTx ? (getDexName(normalTx.to.toLowerCase(), chain) ?? getDexName(normalTx.from?.toLowerCase() ?? "", chain)) : undefined

    // Case 1: Token swap — both incoming and outgoing token transfers in same tx
    if (incoming.length > 0 && outgoing.length > 0) {
      const inTx = incoming[0]
      const outTx = outgoing[0]
      const inDecimals = parseInt(inTx.tokenDecimal || "18")
      const outDecimals = parseInt(outTx.tokenDecimal || "18")
      const inAmount = Number(BigInt(inTx.value)) / Math.pow(10, inDecimals)
      const outAmount = Number(BigInt(outTx.value)) / Math.pow(10, outDecimals)

      // Determine type: if outgoing is a known stablecoin/native wrapper → SELL, else BUY
      const type: TransactionType = "SWAP"

      transactions.push({
        txHash: hash, chain, type, blockNumber: blockNum, blockTimestamp: timestamp,
        tokenInAddress: (outTx.contractAddress || "").toLowerCase(),
        tokenInSymbol: outTx.tokenSymbol,
        tokenInAmount: outAmount,
        tokenOutAddress: (inTx.contractAddress || "").toLowerCase(),
        tokenOutSymbol: inTx.tokenSymbol,
        tokenOutAmount: inAmount,
        tokenAddress: (inTx.contractAddress || "").toLowerCase(),
        tokenSymbol: inTx.tokenSymbol,
        tokenName: inTx.tokenName,
        tokenDecimals: inDecimals,
        amountFormatted: inAmount,
        fromAddress: outTx.from.toLowerCase(),
        toAddress: inTx.to.toLowerCase(),
        dexName,
      })
      continue
    }

    // Case 2: BUY — native ETH sent to DEX, token received
    if (incoming.length > 0 && nativeValueWei > 0n) {
      const inTx = incoming[0]
      const inDecimals = parseInt(inTx.tokenDecimal || "18")
      const inAmount = Number(BigInt(inTx.value)) / Math.pow(10, inDecimals)

      transactions.push({
        txHash: hash, chain, type: "BUY", blockNumber: blockNum, blockTimestamp: timestamp,
        tokenInSymbol: nativeSymbol,
        tokenInAmount: nativeValueFormatted,
        tokenOutAddress: (inTx.contractAddress || "").toLowerCase(),
        tokenOutSymbol: inTx.tokenSymbol,
        tokenOutAmount: inAmount,
        tokenAddress: (inTx.contractAddress || "").toLowerCase(),
        tokenSymbol: inTx.tokenSymbol,
        tokenName: inTx.tokenName,
        tokenDecimals: inDecimals,
        amountFormatted: inAmount,
        fromAddress: normalTx?.from?.toLowerCase() ?? wallet,
        toAddress: normalTx?.to?.toLowerCase() ?? "",
        dexName,
      })
      continue
    }

    // Case 3: SELL — token sent out, native ETH received (check if DEX interaction)
    if (outgoing.length > 0 && hasDex) {
      const outTx = outgoing[0]
      const outDecimals = parseInt(outTx.tokenDecimal || "18")
      const outAmount = Number(BigInt(outTx.value)) / Math.pow(10, outDecimals)

      transactions.push({
        txHash: hash, chain, type: "SELL", blockNumber: blockNum, blockTimestamp: timestamp,
        tokenInAddress: (outTx.contractAddress || "").toLowerCase(),
        tokenInSymbol: outTx.tokenSymbol,
        tokenInAmount: outAmount,
        tokenOutSymbol: nativeSymbol,
        tokenOutAmount: nativeValueFormatted > 0 ? nativeValueFormatted : undefined,
        tokenAddress: (outTx.contractAddress || "").toLowerCase(),
        tokenSymbol: outTx.tokenSymbol,
        tokenName: outTx.tokenName,
        tokenDecimals: outDecimals,
        amountFormatted: outAmount,
        fromAddress: outTx.from.toLowerCase(),
        toAddress: outTx.to.toLowerCase(),
        dexName,
      })
      continue
    }

    // Case 4: Simple token transfers — no swap correlation found
    for (const tx of transfers) {
      const decimals = parseInt(tx.tokenDecimal || "18")
      const amount = Number(BigInt(tx.value)) / Math.pow(10, decimals)
      const isIncoming = tx.to.toLowerCase() === wallet

      transactions.push({
        txHash: tx.hash, chain,
        type: isIncoming ? "TRANSFER_IN" : "TRANSFER_OUT",
        blockNumber: BigInt(tx.blockNumber),
        blockTimestamp: new Date(Number(tx.timeStamp) * 1000),
        tokenAddress: (tx.contractAddress || "").toLowerCase(),
        tokenSymbol: tx.tokenSymbol,
        tokenName: tx.tokenName,
        tokenDecimals: decimals,
        amountRaw: tx.value,
        amountFormatted: amount,
        fromAddress: tx.from.toLowerCase(),
        toAddress: tx.to.toLowerCase(),
      })
    }
  }

  // Process normal txs that had no token transfers (pure ETH transfers)
  for (const tx of normalTxs) {
    if (tx.isError === "1") continue
    const hash = tx.hash.toLowerCase()
    if (processedHashes.has(hash)) continue

    const blockNum = BigInt(tx.blockNumber)
    const type = classifyEvmTransaction(tx, address, chain)
    const valueWei = BigInt(tx.value)
    const valueEth = Number(valueWei) / 1e18

    transactions.push({
      txHash: tx.hash, chain, type,
      blockNumber: blockNum,
      blockTimestamp: new Date(Number(tx.timeStamp) * 1000),
      fromAddress: tx.from.toLowerCase(),
      toAddress: tx.to.toLowerCase(),
      amountRaw: tx.value,
      amountFormatted: valueEth,
      dexName: getDexName(tx.to.toLowerCase(), chain),
    })
  }

  return {
    transactions,
    lastBlock: maxBlock > 0n ? maxBlock : undefined,
  }
}

function classifyEvmTransaction(
  tx: EtherscanTx,
  walletAddress: string,
  chain: TrackerChain
): TransactionType {
  const to = tx.to.toLowerCase()
  const from = tx.from.toLowerCase()
  const wallet = walletAddress.toLowerCase()

  // Check if interacting with a known DEX router
  const dexEntry = DEX_ROUTERS[to]
  if (dexEntry && dexEntry.chains.includes(chain)) {
    // If wallet sent the tx to a DEX, it's either a BUY or SELL
    if (from === wallet) {
      // Heuristic: if sending ETH to DEX, likely buying tokens
      return BigInt(tx.value) > 0n ? "BUY" : "SELL"
    }
    return "SWAP"
  }

  // Approve transactions
  if (tx.methodId === "0x095ea7b3") {
    return "APPROVE"
  }

  // Simple transfers
  if (from === wallet) return "TRANSFER_OUT"
  if (to === wallet) return "TRANSFER_IN"

  return "UNKNOWN"
}

export function getDexName(toAddress: string, chain: TrackerChain): string | undefined {
  const dex = DEX_ROUTERS[toAddress]
  if (dex && dex.chains.includes(chain)) return dex.name
  return undefined
}

export async function fetchEtherscanApi<T>(
  baseUrl: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(baseUrl)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Etherscan API error: ${res.status}`)
  }

  const data = await res.json()

  if (data.status === "0" && data.message === "No transactions found") {
    return [] as unknown as T
  }

  if (data.status === "0") {
    throw new Error(`Etherscan API error: ${data.message || data.result}`)
  }

  return data.result as T
}
