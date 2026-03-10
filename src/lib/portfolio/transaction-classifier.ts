/**
 * Transaction Classification Engine.
 *
 * Classifies cached transactions into semantic categories:
 * - internal_transfer: wallet-to-protocol or wallet-to-wallet (net-worth neutral)
 * - swap: token exchange within same txHash (net-worth neutral in USD)
 * - inflow: external money in (from fiat ramp, bridge, airdrop)
 * - outflow: external money out (to fiat ramp, bridge, spending)
 * - yield: staking rewards, interest, farming rewards
 * - gas: transaction fee payments
 * - spam: airdropped spam tokens
 */

import { db } from "@/lib/db"
import { isLikelySpamTokenSymbol, normalizeSymbolForPricing } from "./price-resolver"
import { normalizeWalletAddress } from "./utils"

export type TxClassification =
  | "internal_transfer"
  | "swap"
  | "inflow"
  | "outflow"
  | "yield"
  | "gas"
  | "spam"

/**
 * Well-known DeFi protocol router/vault contract addresses.
 * Transfers to/from these are classified as internal_transfer.
 * Keys are lowercase addresses.
 */
const DEFI_PROTOCOL_ADDRESSES = new Set([
  // Aave V3 Pool — Ethereum
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",
  // Aave V3 Pool — Arbitrum, Polygon, Optimism (same address across chains)
  "0x794a61358d6845594f94dc1db02a252b5b4814ad",
  // Aave V3 Pool — Base
  "0xa238dd80c259a72e81d7e4664a9801593f98d1c5",
  // Compound V3 cUSDCv3
  "0xc3d688b66703497daa19211eedff47f25384cdc3",
  // Compound V3 cWETHv3
  "0xa17581a9e3356d9a858b789d68b4d866e593ae94",
  // Uniswap V3 Router
  "0xe592427a0aece92de3edee1f18e0157c05861564",
  // Uniswap Universal Router (same address across Ethereum, Arbitrum, Base)
  "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad",
  // 1inch V5 Router
  "0x1111111254eeb25477b68fb85ed929f73a960582",
  // 0x Exchange Proxy
  "0xdef1c0ded9bec7f1a1670819833240f027b25eff",
  // Lido stETH
  "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",
  // Lido wstETH
  "0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0",
  // Curve 3pool
  "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7",
  // Sushiswap Router
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",
  // Paraswap V5
  "0xdef171fe48cf0115b1d80b88dc8eab59176fee57",
  // Stargate Router
  "0x8731d54e9d02c286767d56ac03e8037c07e01e98",
  // Across Bridge V2 SpokePool
  "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5",
  // Hop Protocol Bridge
  "0xb8901acb165ed027e32754e0ffe830802919727f",
])

/**
 * Well-known Solana DeFi program addresses.
 * Base58 — case-sensitive, do NOT lowercase.
 */
const SOLANA_DEFI_PROGRAM_ADDRESSES = new Set([
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",  // Jupiter V6
  "jupoNjAxXgZ4rjzxzPMP4oxduvQsQtZzyknqvzYNrNu",  // Jupiter Limit
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM V4
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium CLMM
  "MarBmsSgKXdrN1egZf5sqe1TMai9K1rChYNDJgjq7aD",  // Marinade
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",  // Orca Whirlpool
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",  // Meteora DLMM
])

/**
 * Known reward distributor contracts.
 * Transfers FROM these are classified as yield.
 */
const YIELD_DISTRIBUTOR_ADDRESSES = new Set([
  // Aave Incentives Controller (Ethereum)
  "0x8164cc65827dcfe994ab23944cbc90e0aa80bfcb",
  // Lido Reward Program
  "0x753d5167c31fbeb5b49624314d74a957eb271709",
])

interface TransactionRow {
  id: string
  txHash: string
  chain: string
  from: string
  to: string | null
  direction: string
  category: string
  symbol: string | null
  value: number | null
  usdValue: number | null
  walletAddress: string
}

interface ClassificationContext {
  userWalletAddresses: Set<string>
  txsByHash: Map<string, TransactionRow[]>
}

function buildContext(
  transactions: TransactionRow[],
  walletAddresses: string[]
): ClassificationContext {
  const userWalletAddresses = new Set(walletAddresses.map((a) => normalizeWalletAddress(a)))

  const txsByHash = new Map<string, TransactionRow[]>()
  for (const tx of transactions) {
    const existing = txsByHash.get(tx.txHash) ?? []
    existing.push(tx)
    txsByHash.set(tx.txHash, existing)
  }

  return { userWalletAddresses, txsByHash }
}

function classifySingle(
  tx: TransactionRow,
  ctx: ClassificationContext
): TxClassification {
  const toAddr = normalizeWalletAddress(tx.to ?? "")
  const fromAddr = normalizeWalletAddress(tx.from)

  // Rule 0: Explicit gas fee rows (from mapper)
  if (tx.category === "gas") {
    return "gas"
  }

  // Rule 1: Spam token detection
  if (isLikelySpamTokenSymbol(tx.symbol)) {
    return "spam"
  }

  // Rule 2: Same txHash has both in+out → swap or internal_transfer
  const siblings = ctx.txsByHash.get(tx.txHash) ?? []
  if (siblings.length > 1) {
    const hasIn = siblings.some((s) => s.direction === "in")
    const hasOut = siblings.some((s) => s.direction === "out")
    if (hasIn && hasOut) {
      // If different asset symbols → swap; same symbol → internal_transfer
      // Use symbol only (not chain) to avoid misclassifying cross-chain bridges as swaps
      const symbols = siblings
        .map((s) => normalizeSymbolForPricing(s.symbol))
        .filter((s): s is string => s !== null)
      const uniqueSymbols = new Set(symbols)
      // If we have symbols and they differ → swap; otherwise → internal_transfer
      return uniqueSymbols.size > 1 ? "swap" : "internal_transfer"
    }
  }

  // Rule 3: Transfer between user's own wallets
  // Check both from/to AND the tracked walletAddress to catch cases where
  // the tx row only has one side in the user's wallet set
  if (ctx.userWalletAddresses.has(toAddr) && ctx.userWalletAddresses.has(fromAddr)) {
    return "internal_transfer"
  }
  // Also detect: outflow where destination is user's own wallet
  if (tx.direction === "out" && toAddr && ctx.userWalletAddresses.has(toAddr)) {
    return "internal_transfer"
  }
  // Also detect: inflow where source is user's own wallet
  if (tx.direction === "in" && fromAddr && ctx.userWalletAddresses.has(fromAddr)) {
    return "internal_transfer"
  }

  // Rule 4: Yield from known reward distributors
  if (tx.direction === "in" && YIELD_DISTRIBUTOR_ADDRESSES.has(fromAddr)) {
    return "yield"
  }

  // Rule 5: Interaction with known DeFi protocol contracts
  // EVM: lowercased check. Solana: original-case check.
  const toOriginal = tx.to ?? ""
  const fromOriginal = tx.from
  if (
    DEFI_PROTOCOL_ADDRESSES.has(toAddr) || DEFI_PROTOCOL_ADDRESSES.has(fromAddr) ||
    SOLANA_DEFI_PROGRAM_ADDRESSES.has(toOriginal) || SOLANA_DEFI_PROGRAM_ADDRESSES.has(fromOriginal)
  ) {
    return "internal_transfer"
  }

  // Rule 6: Gas — tiny native token outflow (< $5) with no corresponding in transfer
  if (
    tx.direction === "out" &&
    tx.category === "external" &&
    !tx.symbol && // native token (no explicit symbol in many providers)
    tx.usdValue !== null &&
    Math.abs(tx.usdValue) < 5 &&
    siblings.length === 1
  ) {
    return "gas"
  }

  // Also detect gas by very small ETH outflows
  if (
    tx.direction === "out" &&
    tx.category === "external" &&
    tx.value !== null &&
    tx.value < 0.01 &&
    (tx.symbol === "ETH" || tx.symbol === null) &&
    siblings.length === 1
  ) {
    return "gas"
  }

  // Rule 7: Default based on direction
  return tx.direction === "in" ? "inflow" : "outflow"
}

/**
 * Classify a batch of unclassified transactions for a user.
 * Returns the number of transactions classified.
 */
export async function classifyUserTransactions(
  userId: string,
  batchSize: number = 1000
): Promise<{ classified: number; total: number }> {
  const wallets = await db.trackedWallet.findMany({
    where: { userId },
    select: { address: true },
  })
  const walletAddresses = wallets.map((w) => w.address.toLowerCase())

  // Fetch unclassified transactions
  const unclassified = await db.transactionCache.findMany({
    where: {
      userId,
      txClassification: null,
    },
    select: {
      id: true,
      txHash: true,
      chain: true,
      from: true,
      to: true,
      direction: true,
      category: true,
      symbol: true,
      value: true,
      usdValue: true,
      walletAddress: true,
    },
    orderBy: { blockTimestamp: "asc" },
    take: batchSize,
  })

  if (unclassified.length === 0) {
    return { classified: 0, total: 0 }
  }

  // Fetch ALL siblings for the txHashes in this batch (including already-classified ones)
  // to ensure swap/in+out detection works even when siblings are in different batches.
  const batchTxHashes = [...new Set(unclassified.map((tx) => tx.txHash))]
  const allSiblings = await db.transactionCache.findMany({
    where: {
      userId,
      txHash: { in: batchTxHashes },
    },
    select: {
      id: true,
      txHash: true,
      chain: true,
      from: true,
      to: true,
      direction: true,
      category: true,
      symbol: true,
      value: true,
      usdValue: true,
      walletAddress: true,
    },
  })

  const ctx = buildContext(allSiblings, walletAddresses)
  const now = new Date()

  // Classify in batch using a transaction
  const updates: Array<{ id: string; classification: TxClassification }> = []
  for (const tx of unclassified) {
    const classification = classifySingle(tx, ctx)
    updates.push({ id: tx.id, classification })
  }

  // Batch update in chunks
  const CHUNK_SIZE = 100
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE)
    await db.$transaction(
      chunk.map((update) =>
        db.transactionCache.update({
          where: { id: update.id },
          data: {
            txClassification: update.classification,
            classifiedAt: now,
          },
        })
      )
    )
  }

  // Count remaining unclassified
  const remainingCount = await db.transactionCache.count({
    where: { userId, txClassification: null },
  })

  return { classified: updates.length, total: remainingCount + updates.length }
}

/**
 * Reclassify all transactions for a user (e.g., after adding new wallets).
 */
export async function reclassifyAllTransactions(userId: string): Promise<{ classified: number }> {
  // Clear existing classifications
  await db.transactionCache.updateMany({
    where: { userId },
    data: { txClassification: null, classifiedAt: null },
  })

  let total = 0
  let batch: { classified: number; total: number }
  do {
    batch = await classifyUserTransactions(userId, 2000)
    total += batch.classified
  } while (batch.classified > 0)

  return { classified: total }
}
