// EVM scanner using public block explorer APIs (no API key, rate-limited).

import type { TrackerChain, NewTransaction, ScanResult, TransactionType } from "../types"
import { CHAIN_CONFIGS } from "../chains"
import { fetchEtherscanApi, getDexName } from "./evm-etherscan"

// Re-export EtherscanTx shape via the shared fetchEtherscanApi helper.
// The interface is intentionally private here — scanEvmWalletFreeExplorer
// only receives the raw JSON from the Etherscan-compatible API.
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

/**
 * Scan EVM wallet using public block explorer APIs without an API key.
 * Works for ALL EVM chains (including BSC which Alchemy doesn't support).
 * Rate limited: ~1 request per 5 seconds on free tier.
 * Uses the same Etherscan-compatible API format with no apikey parameter.
 */
export async function scanEvmWalletFreeExplorer(
  address: string,
  chain: TrackerChain,
  lastBlock?: bigint
): Promise<ScanResult> {
  const config = CHAIN_CONFIGS[chain]
  const startBlock = lastBlock ? (lastBlock + 1n).toString() : "0"

  // Fetch normal transactions (no API key = free tier, rate-limited)
  const normalTxs = await fetchEtherscanApi<EtherscanTx[]>(
    config.explorerApiUrl,
    {
      module: "account",
      action: "txlist",
      address,
      startblock: startBlock,
      endblock: "99999999",
      page: "1",
      offset: "100",
      sort: "desc",
    }
  )

  // Delay between requests to respect free tier rate limits (1 call per 5s without key)
  await new Promise((r) => setTimeout(r, 5500))

  // Fetch ERC-20 token transfers
  const tokenTxs = await fetchEtherscanApi<EtherscanTx[]>(
    config.explorerApiUrl,
    {
      module: "account",
      action: "tokentx",
      address,
      startblock: startBlock,
      endblock: "99999999",
      page: "1",
      offset: "100",
      sort: "desc",
    }
  )

  // Reuse the same processing logic as the legacy Etherscan scanner
  const transactions: NewTransaction[] = []
  let maxBlock = lastBlock ?? 0n

  // Group token transfers by hash
  const tokenTxsByHash = new Map<string, EtherscanTx[]>()
  for (const tx of tokenTxs) {
    const hash = tx.hash.toLowerCase()
    if (!tokenTxsByHash.has(hash)) tokenTxsByHash.set(hash, [])
    tokenTxsByHash.get(hash)!.push(tx)
  }

  const processedHashes = new Set<string>()

  // Process token transfers first (grouped by txHash)
  for (const [hash, transfers] of tokenTxsByHash) {
    processedHashes.add(hash)
    const blockNum = BigInt(transfers[0].blockNumber)
    if (blockNum > maxBlock) maxBlock = blockNum

    const incoming = transfers.filter((t) => t.to.toLowerCase() === address.toLowerCase())
    const outgoing = transfers.filter((t) => t.from.toLowerCase() === address.toLowerCase())
    const matchingNormal = normalTxs.find((n) => n.hash.toLowerCase() === hash)
    const ethSent = matchingNormal ? BigInt(matchingNormal.value) : 0n

    let type: TransactionType
    if (incoming.length > 0 && outgoing.length > 0) type = "SWAP"
    else if (incoming.length > 0 && ethSent > 0n) type = "BUY"
    else if (outgoing.length > 0) type = "SELL"
    else if (incoming.length > 0) type = "TRANSFER_IN"
    else type = "UNKNOWN"

    const primary = incoming[0] ?? outgoing[0]
    const decimals = primary.tokenDecimal ? parseInt(primary.tokenDecimal) : 18
    const amount = parseFloat(primary.value) / Math.pow(10, decimals)

    transactions.push({
      txHash: primary.hash, chain, type,
      blockNumber: blockNum,
      blockTimestamp: new Date(Number(primary.timeStamp) * 1000),
      tokenAddress: primary.contractAddress?.toLowerCase(),
      tokenSymbol: primary.tokenSymbol,
      tokenName: primary.tokenName,
      tokenDecimals: decimals,
      amountRaw: primary.value,
      amountFormatted: amount,
      fromAddress: primary.from.toLowerCase(),
      toAddress: primary.to.toLowerCase(),
      dexName: getDexName(matchingNormal?.to?.toLowerCase() ?? "", chain),
      // Swap details
      ...(type === "BUY" && incoming[0] ? {
        tokenInSymbol: config.nativeToken,
        tokenInAmount: Number(ethSent) / 1e18,
        tokenOutAddress: incoming[0].contractAddress?.toLowerCase(),
        tokenOutSymbol: incoming[0].tokenSymbol,
        tokenOutAmount: amount,
      } : {}),
      ...(type === "SELL" && outgoing[0] ? {
        tokenInAddress: outgoing[0].contractAddress?.toLowerCase(),
        tokenInSymbol: outgoing[0].tokenSymbol,
        tokenInAmount: amount,
        tokenOutSymbol: config.nativeToken,
      } : {}),
    })
  }

  // Process normal txs without token transfers (pure native transfers)
  for (const tx of normalTxs) {
    if (tx.isError === "1") continue
    const hash = tx.hash.toLowerCase()
    if (processedHashes.has(hash)) continue

    const blockNum = BigInt(tx.blockNumber)
    if (blockNum > maxBlock) maxBlock = blockNum

    // Inline classify (avoids importing the private classifyEvmTransaction)
    const to = tx.to.toLowerCase()
    const from = tx.from.toLowerCase()
    const wallet = address.toLowerCase()
    let type: TransactionType
    if (tx.methodId === "0x095ea7b3") {
      type = "APPROVE"
    } else if (from === wallet) {
      type = "TRANSFER_OUT"
    } else if (to === wallet) {
      type = "TRANSFER_IN"
    } else {
      type = "UNKNOWN"
    }

    const valueWei = BigInt(tx.value)
    const valueNative = Number(valueWei) / 1e18

    transactions.push({
      txHash: tx.hash, chain, type,
      blockNumber: blockNum,
      blockTimestamp: new Date(Number(tx.timeStamp) * 1000),
      fromAddress: tx.from.toLowerCase(),
      toAddress: tx.to.toLowerCase(),
      amountRaw: tx.value,
      amountFormatted: valueNative,
      dexName: getDexName(tx.to.toLowerCase(), chain),
    })
  }

  console.log(`[tracker-scan] Free explorer: ${transactions.length} txs for ${address.slice(0, 10)}... on ${chain}`)

  return {
    transactions,
    lastBlock: maxBlock > 0n ? maxBlock : undefined,
  }
}
