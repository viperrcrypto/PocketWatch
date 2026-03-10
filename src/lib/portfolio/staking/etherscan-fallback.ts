/**
 * Etherscan/block-explorer fallback for fetching token transfer events
 * when Alchemy sync is incomplete or transactions are missing.
 *
 * Only called when buildTxContext returns zero transactions for a position
 * that should have some. Not called on every sync.
 */

import { db } from "@/lib/db"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { CHAIN_CONFIGS } from "@/lib/tracker/chains"
import { getTxChain } from "./constants"

type PrismaClient = typeof db & Record<string, any>

interface EtherscanTransfer {
  blockNumber: string
  timeStamp: string
  hash: string
  from: string
  to: string
  contractAddress: string
  tokenSymbol: string
  tokenDecimal: string
  value: string
}

interface EtherscanApiResponse {
  status: string
  message: string
  result: EtherscanTransfer[] | string
}

const SUPPORTED_CHAINS: Set<string> = new Set(["ETHEREUM", "ARBITRUM", "BASE", "POLYGON"])

/**
 * Fetch ERC-20 token transfers from a block explorer API.
 * Returns the raw transfers for a specific contract address on a wallet.
 */
export async function fetchExplorerTokenTransfers(
  userId: string,
  wallet: string,
  chain: string,
  contractAddress: string,
): Promise<{
  transfers: EtherscanTransfer[]
  error: string | null
}> {
  const txChain = getTxChain(chain) ?? chain.toUpperCase()
  if (!SUPPORTED_CHAINS.has(txChain)) {
    return { transfers: [], error: `Chain ${txChain} not supported for explorer fallback` }
  }

  const chainConfig = (CHAIN_CONFIGS as Record<string, { explorerApiUrl: string; apiKeyService: string }>)[txChain]
  if (!chainConfig?.explorerApiUrl || !chainConfig.apiKeyService) {
    return { transfers: [], error: `No explorer API configured for ${txChain}` }
  }

  const apiKey = await getServiceKey(userId, chainConfig.apiKeyService)
  if (!apiKey) {
    return { transfers: [], error: `No API key for ${chainConfig.apiKeyService}` }
  }

  const url = new URL(chainConfig.explorerApiUrl)
  url.searchParams.set("module", "account")
  url.searchParams.set("action", "tokentx")
  url.searchParams.set("address", wallet)
  url.searchParams.set("contractaddress", contractAddress)
  url.searchParams.set("startblock", "0")
  url.searchParams.set("endblock", "99999999")
  url.searchParams.set("sort", "asc")
  url.searchParams.set("apikey", apiKey)

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) {
      return { transfers: [], error: `Explorer API ${res.status}: ${res.statusText}` }
    }

    const data: EtherscanApiResponse = await res.json()
    if (data.status !== "1" || !Array.isArray(data.result)) {
      const msg = typeof data.result === "string" ? data.result : data.message
      return { transfers: [], error: `Explorer API: ${msg}` }
    }

    return { transfers: data.result, error: null }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { transfers: [], error: `Explorer fetch failed: ${msg}` }
  }
}

/**
 * Backfill missing transactions from block explorer for a specific position.
 * Only inserts rows that don't already exist in TransactionCache.
 */
export async function backfillFromExplorer(
  userId: string,
  wallet: string,
  chain: string,
  contractAddress: string,
): Promise<{ inserted: number; error: string | null }> {
  const { transfers, error } = await fetchExplorerTokenTransfers(
    userId,
    wallet,
    chain,
    contractAddress,
  )

  if (error || transfers.length === 0) {
    return { inserted: 0, error }
  }

  const prisma = db as PrismaClient
  const txChain = getTxChain(chain) ?? chain.toUpperCase()
  const normalizedWallet = wallet.toLowerCase()
  let inserted = 0

  for (const tx of transfers) {
    const from = tx.from.toLowerCase()
    const to = tx.to.toLowerCase()
    const direction = to === normalizedWallet ? "in" : "out"
    const decimals = Number(tx.tokenDecimal) || 18
    const rawValue = tx.value
    const value = Number(rawValue) / Math.pow(10, decimals)
    const blockTimestamp = Number(tx.timeStamp)

    if (!Number.isFinite(value) || value <= 0) continue
    if (!Number.isFinite(blockTimestamp) || blockTimestamp <= 0) continue

    try {
      await prisma.transactionCache.upsert({
        where: {
          userId_chain_txHash_category_from_to: {
            userId,
            chain: txChain,
            txHash: tx.hash.toLowerCase(),
            category: "erc20",
            from,
            to,
          },
        },
        create: {
          userId,
          walletAddress: normalizedWallet,
          chain: txChain,
          txHash: tx.hash.toLowerCase(),
          blockNumber: Number(tx.blockNumber) || 0,
          blockTimestamp,
          category: "erc20",
          from,
          to,
          asset: tx.contractAddress.toLowerCase(),
          symbol: tx.tokenSymbol.toUpperCase(),
          decimals,
          rawValue,
          value,
          usdValue: null, // Will be resolved by price-resolver
          direction,
        },
        update: {}, // Don't overwrite existing
      })
      inserted++
    } catch {
      // Unique constraint violations are expected — skip duplicates
    }
  }

  if (inserted > 0) {
    console.log(`[etherscan-fallback] inserted ${inserted} txs for ${contractAddress} on ${txChain}`)
  }

  return { inserted, error: null }
}
