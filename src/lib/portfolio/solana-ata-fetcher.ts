/**
 * Fetch incoming SPL token transfers via ATA signatures + Helius parsing.
 */

import { db } from "@/lib/db"
import { isProviderThrottleError, withProviderPermitRotating } from "./provider-governor"
import type { ServiceKeyEntry } from "./service-keys"
import { heliusTxToRecords } from "./solana-tx-mapper"
import type { HeliusTransaction, TransactionCacheRecord } from "./solana-tx-mapper"
import type { SyncErrorDetail } from "./transaction-fetcher"
import { discoverTokenAccounts, getSignaturesForAddress, resolveSPLToken } from "./solana-rpc"

/** Parse transaction signatures via Helius POST /v0/transactions. */
async function parseTransactionsViaHelius(
  signatures: string[],
  apiKey: string,
): Promise<HeliusTransaction[]> {
  if (signatures.length === 0) return []

  const res = await fetch(
    `https://api.helius.xyz/v0/transactions?api-key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: signatures }),
      signal: AbortSignal.timeout(30_000),
    },
  )
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw Object.assign(new Error(`Helius parse ${res.status}: ${body.slice(0, 180)}`), { status: res.status })
  }
  return res.json()
}

/** Resolve SPL token symbols for records. */
export async function backfillSPLSymbols(records: TransactionCacheRecord[]): Promise<void> {
  const splMints = new Set(
    records
      .filter((r) => r.category === "erc20" && r.asset && r.asset !== "native")
      .map((r) => r.asset!),
  )
  for (const mint of splMints) {
    try {
      const meta = await resolveSPLToken(mint)
      for (const rec of records) {
        if (rec.asset === mint && rec.category === "erc20") {
          rec.symbol = meta.symbol
          rec.decimals = meta.decimals
        }
      }
    } catch { /* keep null */ }
  }
}

function throttleDetailFromError(error: unknown, fallbackMessage: string): SyncErrorDetail {
  if (isProviderThrottleError(error)) {
    const retryAfterSec = error.nextAllowedAt
      ? Math.min(300, Math.max(5, Math.ceil((error.nextAllowedAt.getTime() - Date.now()) / 1000)))
      : 90
    return { code: "helius_rate_limited", message: error.message, status: 429, retryable: true, retryAfterSec }
  }
  const status = error != null && typeof error === "object" && typeof (error as Record<string, unknown>).status === "number"
    ? (error as { status: number }).status
    : undefined
  const lower = (error instanceof Error ? error.message : fallbackMessage).toLowerCase()
  if (status === 429 || lower.includes("rate") || lower.includes("too many requests")) {
    return { code: "helius_rate_limited", message: error instanceof Error ? error.message : fallbackMessage, status, retryable: true, retryAfterSec: 90 }
  }
  return { code: "helius_error", message: error instanceof Error ? error.message : fallbackMessage, status, retryable: true, retryAfterSec: 45 }
}

/**
 * Fetch incoming token transfers via ATA signatures + Helius parsing.
 * Returns the number of new records inserted.
 */
export async function fetchATATransactions(options: {
  userId: string
  walletAddress: string
  heliusKeys: ServiceKeyEntry[]
  syncMode: string
  maxSignaturesPerATA: number
}): Promise<{ newRecords: number; ataCount: number; requestsUsed: number; errors: SyncErrorDetail[] }> {
  const { userId, walletAddress, syncMode, heliusKeys } = options
  const errors: SyncErrorDetail[] = []
  let newRecords = 0
  let requestsUsed = 0

  // 1. Discover all ATAs for the wallet
  let atas: string[]
  try {
    atas = await discoverTokenAccounts(walletAddress)
  } catch (err) {
    errors.push({ code: "solana_rpc_error", message: `ATA discovery failed: ${err instanceof Error ? err.message : String(err)}`, retryable: true, retryAfterSec: 30 })
    return { newRecords: 0, ataCount: 0, requestsUsed: 0, errors }
  }

  if (atas.length === 0) return { newRecords: 0, ataCount: 0, requestsUsed: 0, errors }

  // 2. Collect signatures from all ATAs
  const allSigs: string[] = []
  let ataFetchFailures = 0
  for (const ata of atas) {
    try {
      const sigs = await getSignaturesForAddress(ata, {
        limit: options.maxSignaturesPerATA,
      })
      allSigs.push(...sigs.map((s) => s.signature))
    } catch (err) {
      ataFetchFailures += 1
      console.warn(`[solana-fetcher] Failed to fetch sigs for ATA ${ata.slice(0, 12)}:`, err instanceof Error ? err.message : String(err))
    }
  }
  if (ataFetchFailures > 0) {
    console.warn(`[solana-fetcher] ${ataFetchFailures}/${atas.length} ATA signature fetches failed`)
  }

  // 3. Deduplicate and filter out already-cached signatures
  const uniqueSigs = [...new Set(allSigs)]
  if (uniqueSigs.length === 0) return { newRecords: 0, ataCount: atas.length, requestsUsed: 0, errors }

  const existing = await db.transactionCache.findMany({
    where: { userId, chain: "SOLANA", txHash: { in: uniqueSigs } },
    select: { txHash: true },
    distinct: ["txHash"],
  })
  const cachedSet = new Set(existing.map((e) => e.txHash))
  const newSigs = uniqueSigs.filter((sig) => !cachedSet.has(sig))

  if (newSigs.length === 0) return { newRecords: 0, ataCount: atas.length, requestsUsed: 0, errors }

  // 4. Parse new signatures via Helius in batches of 100
  const allRecords: TransactionCacheRecord[] = []
  for (let i = 0; i < newSigs.length; i += 100) {
    const batch = newSigs.slice(i, i + 100)
    try {
      const parsed = await withProviderPermitRotating(
        userId,
        "helius",
        `solana-ata-txs:${walletAddress}`,
        undefined,
        heliusKeys,
        async (keyEntry) => parseTransactionsViaHelius(batch, keyEntry.key),
      ) as HeliusTransaction[]
      requestsUsed += 1

      for (const htx of parsed) {
        const records = heliusTxToRecords(htx, userId, walletAddress)
        allRecords.push(...records)
      }
    } catch (err) {
      const detail = throttleDetailFromError(err, "Helius ATA parse failed")
      errors.push(detail)
      break
    }
  }

  // 5. Backfill SPL symbols and insert
  if (allRecords.length > 0) {
    await backfillSPLSymbols(allRecords)
    const result = await db.transactionCache.createMany({
      data: allRecords,
      skipDuplicates: true,
    })
    newRecords = result.count
  }

  return { newRecords, ataCount: atas.length, requestsUsed, errors }
}
