/**
 * Multi-provider balance fetcher orchestrator.
 *
 * Splits wallets by chain type, dispatches to the right provider,
 * and implements waterfall fallback on rate-limit (429).
 *
 * EVM:    Zerion → Alchemy → Moralis
 * Solana: Helius → Alchemy
 * BTC:    skipped (no dedicated provider wired yet)
 */

import { createHash } from "node:crypto"
import { getServiceKey } from "./service-keys"
import { withProviderPermit, isProviderThrottleError } from "./provider-governor"
import { fetchMultiWalletPositions, type MultiWalletResult, type ZerionWalletData } from "./zerion-client"
import { fetchMultiHeliusBalances } from "./helius-balance-client"
import { fetchMultiAlchemyBalances } from "./alchemy-balance-client"
import { fetchMultiMoralisBalances } from "./moralis-balance-client"

// Chains treated as EVM — Zerion/Alchemy/Moralis can fetch these.
// Includes both DB format (uppercase short codes) and Zerion format (lowercase full names).
const EVM_CHAINS = new Set([
  // DB format (TrackedWallet.chains)
  "ETH", "ARBITRUM_ONE", "BASE", "POLYGON_POS", "BSC", "OPTIMISM",
  "LINEA", "SCROLL", "ZKSYNC", "AVAX", "GNOSIS", "BLAST", "MANTLE",
  "MODE", "FANTOM", "ZORA", "BERACHAIN", "MONAD",
  // Zerion format (lowercase)
  "ethereum", "arbitrum", "base", "polygon", "binance-smart-chain",
  "optimism", "linea", "scroll", "zksync-era",
])

const SOLANA_CHAINS = new Set(["solana", "SOL"])
const BTC_CHAINS = new Set(["btc", "BTC"])

interface WalletInput {
  address: string
  chains: string[]
}

/** Short hash of wallet addresses for operation key (must fit in btree index). */
function walletFingerprint(addresses: string[]): string {
  const sorted = addresses.map((a) => a.toLowerCase()).sort().join("|")
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16)
}

/** Check if an error is a 429 rate-limit (from any provider). */
function is429(err: unknown): boolean {
  if (isProviderThrottleError(err)) return true
  if (err && typeof err === "object" && (err as Record<string, unknown>).status === 429) return true
  if (err instanceof Error && err.message.includes("429")) return true
  return false
}

/**
 * Fetch EVM balances with waterfall fallback: Zerion → Alchemy → Moralis.
 * Only attempts providers that have API keys configured.
 */
async function fetchEvmBalances(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  if (wallets.length === 0) return { wallets: [], failedCount: 0 }

  const addresses = wallets.map((w) => w.address)

  // ─── Try Zerion (primary) ───
  const zerionKey = await getServiceKey(userId, "zerion")
  if (zerionKey) {
    try {
      return await withProviderPermit(
        userId, "zerion", `evm-positions:${walletFingerprint(addresses)}`, undefined,
        () => fetchMultiWalletPositions(zerionKey, addresses),
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[multi-fetch] Zerion failed for EVM (${reason}) — trying Alchemy fallback`)
    }
  }

  // ─── Try Alchemy (fallback) ───
  const alchemyKey = await getServiceKey(userId, "alchemy")
  if (alchemyKey) {
    try {
      return await withProviderPermit(
        userId, "alchemy", `evm-balances`, undefined,
        () => fetchMultiAlchemyBalances(alchemyKey, wallets),
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[multi-fetch] Alchemy failed for EVM (${reason}) — trying Moralis fallback`)
    }
  }

  // ─── Try Moralis (fallback) ───
  const moralisKey = await getServiceKey(userId, "moralis")
  if (moralisKey) {
    try {
      return await withProviderPermit(
        userId, "moralis", `evm-balances`, undefined,
        () => fetchMultiMoralisBalances(moralisKey, wallets),
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[multi-fetch] Moralis failed for EVM (${reason}) — all EVM providers exhausted`)
    }
  }

  // All providers exhausted or missing — return empty with failedCount
  console.warn(`[multi-fetch] No EVM provider available for ${wallets.length} wallets`)
  return { wallets: [], failedCount: wallets.length }
}

/**
 * Fetch Solana balances with waterfall fallback: Helius → Alchemy.
 */
async function fetchSolanaBalances(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  if (wallets.length === 0) return { wallets: [], failedCount: 0 }

  const addresses = wallets.map((w) => w.address)

  // ─── Try Helius (primary) ───
  const heliusKey = await getServiceKey(userId, "helius")
  if (heliusKey) {
    try {
      return await withProviderPermit(
        userId, "helius", `sol-balances`, undefined,
        () => fetchMultiHeliusBalances(heliusKey, addresses),
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[multi-fetch] Helius failed for Solana (${reason}) — trying Alchemy fallback`)
    }
  }

  // ─── Try Alchemy (fallback — supports Solana) ───
  const alchemyKey = await getServiceKey(userId, "alchemy")
  if (alchemyKey) {
    try {
      const solWallets = wallets.map((w) => ({ address: w.address, chains: ["SOL"] }))
      return await withProviderPermit(
        userId, "alchemy", `sol-balances`, undefined,
        () => fetchMultiAlchemyBalances(alchemyKey, solWallets),
      )
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`[multi-fetch] Alchemy failed for Solana (${reason}) — all Solana providers exhausted`)
    }
  }

  console.warn(`[multi-fetch] No Solana provider available for ${wallets.length} wallets`)
  return { wallets: [], failedCount: wallets.length }
}

/**
 * Fetch balances for all wallets across all chain types.
 *
 * Splits wallets by chain type (EVM vs Solana), dispatches to the
 * right provider chain, merges results, and returns unified MultiWalletResult.
 */
export async function fetchAllWalletBalances(
  userId: string,
  wallets: WalletInput[],
): Promise<MultiWalletResult> {
  // Split wallets by chain type
  const evmWallets: WalletInput[] = []
  const solanaWallets: WalletInput[] = []

  for (const w of wallets) {
    const hasEvm = w.chains.some((c) => EVM_CHAINS.has(c))
    const hasSolana = w.chains.some((c) => SOLANA_CHAINS.has(c))

    if (hasEvm) evmWallets.push(w)
    if (hasSolana) solanaWallets.push(w)
    // BTC wallets are skipped for now
  }

  console.log(
    `[multi-fetch] Dispatching: ${evmWallets.length} EVM, ${solanaWallets.length} Solana` +
    ` (${wallets.length - evmWallets.length - solanaWallets.length} skipped)`,
  )

  // Fetch EVM and Solana in parallel — use allSettled so one chain type failing doesn't kill the other
  const [evmSettled, solanaSettled] = await Promise.allSettled([
    fetchEvmBalances(userId, evmWallets),
    fetchSolanaBalances(userId, solanaWallets),
  ])

  const evmResult = evmSettled.status === "fulfilled"
    ? evmSettled.value
    : { wallets: [] as ZerionWalletData[], failedCount: evmWallets.length }
  const solanaResult = solanaSettled.status === "fulfilled"
    ? solanaSettled.value
    : { wallets: [] as ZerionWalletData[], failedCount: solanaWallets.length }

  if (evmSettled.status === "rejected") {
    console.warn(`[multi-fetch] EVM fetch failed: ${evmSettled.reason?.message ?? "unknown"}`)
  }
  if (solanaSettled.status === "rejected") {
    console.warn(`[multi-fetch] Solana fetch failed: ${solanaSettled.reason?.message ?? "unknown"}`)
  }

  // Merge results
  const mergedWallets: ZerionWalletData[] = [...evmResult.wallets, ...solanaResult.wallets]
  const totalFailed = evmResult.failedCount + solanaResult.failedCount

  const totalPositions = mergedWallets.reduce((s, w) => s + w.positions.length, 0)
  console.log(
    `[multi-fetch] Complete: ${mergedWallets.length} wallets, ${totalPositions} positions, ${totalFailed} failed`,
  )

  if (mergedWallets.length === 0 && wallets.length > 0) {
    throw new Error(`All ${wallets.length} wallet fetches failed across all providers`)
  }

  return { wallets: mergedWallets, failedCount: totalFailed }
}
