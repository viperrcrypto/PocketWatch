/**
 * Individual quality check analyzers for transaction data.
 * Each function inspects a specific aspect and pushes issues to the provided array.
 */

import { ALCHEMY_TRANSFER_CHAINS, ETHERSCAN_SYNC_CHAINS } from "@/lib/tracker/chains"
import { ZERION_MULTI_CHAIN } from "@/lib/portfolio/zerion-transaction-fetcher"
import type { QualityIssue, ChainDetail } from "@/lib/portfolio/quality-check-helpers"

// ── Check 1: Structural integrity ──

export function checkStructuralIntegrity(
  issues: QualityIssue[],
  counts: {
    futureCount: number; ancientCount: number; nullHashCount: number
    nullFromCount: number; zeroValueCount: number; nullValueCount: number; totalRows: number
  }
) {
  const { futureCount, ancientCount, nullHashCount, nullFromCount, zeroValueCount, nullValueCount, totalRows } = counts

  if (futureCount > 0) {
    issues.push({
      severity: "error",
      chain: null, wallet: null,
      code: "future_timestamps",
      message: `${futureCount} transactions have timestamps >1 hour in the future`,
      detail: "These rows have bad blockTimestamp values — likely ingestion bug",
    })
  }

  if (ancientCount > 0) {
    issues.push({
      severity: "warning",
      chain: null, wallet: null,
      code: "ancient_timestamps",
      message: `${ancientCount} transactions dated before Ethereum genesis (Jul 2015)`,
      detail: "Check if blockTimestamp was parsed incorrectly (e.g. milliseconds stored as seconds)",
    })
  }

  if (nullHashCount > 0) {
    issues.push({
      severity: "error",
      chain: null, wallet: null,
      code: "empty_tx_hashes",
      message: `${nullHashCount} transactions with empty txHash`,
      detail: "These rows cannot be deduplicated and may cause incorrect balances",
    })
  }

  if (nullFromCount > 0) {
    issues.push({
      severity: "warning",
      chain: null, wallet: null,
      code: "empty_from_address",
      message: `${nullFromCount} transactions with empty from address`,
    })
  }

  if (zeroValueCount > 0) {
    const pct = totalRows > 0 ? Math.round((zeroValueCount / totalRows) * 100) : 0
    issues.push({
      severity: pct > 30 ? "warning" : "info",
      chain: null, wallet: null,
      code: "zero_value_txs",
      message: `${zeroValueCount} (${pct}%) transactions with zero value`,
      detail: "Common for approvals and contract interactions — only a problem if most are zero",
    })
  }

  if (nullValueCount > 0) {
    const pct = totalRows > 0 ? Math.round((nullValueCount / totalRows) * 100) : 0
    issues.push({
      severity: pct > 20 ? "warning" : "info",
      chain: null, wallet: null,
      code: "null_value_txs",
      message: `${nullValueCount} (${pct}%) transactions with unparseable value`,
      detail: "Value field is null — raw BigInt couldn't be converted to float",
    })
  }
}

// ── Check 2: Per-chain completeness ──

export function checkChainCompleteness(
  issues: QualityIssue[],
  chainDetail: Record<string, ChainDetail>,
  perWalletChainCounts: Array<{ walletAddress: string; chain: string; _count: { _all: number } }>,
  zerionMultiByWallet: Map<string, unknown>,
  nowSec: number
) {
  const zerionSyncedChains = new Set<string>()
  for (const wc of perWalletChainCounts) {
    if (wc.chain !== "SOLANA" && zerionMultiByWallet.has(wc.walletAddress.toLowerCase())) {
      zerionSyncedChains.add(wc.chain)
    }
  }

  const alchemyCategories = ["external", "erc20", "erc721", "internal"]
  const zerionCategories = ["external", "erc20", "erc721"]

  for (const [chain, detail] of Object.entries(chainDetail)) {
    if (chain === "SOLANA") continue

    const isZerionChain = zerionSyncedChains.has(chain)
    const expectedCategories = isZerionChain ? zerionCategories : alchemyCategories
    const presentCats = Object.keys(detail.categories)
    const missingCats = expectedCategories.filter((c) => !presentCats.includes(c))

    if (missingCats.length > 0 && detail.count > 20 && detail.syncComplete) {
      const hasOutgoing = detail.directions.out > 0
      const onlyMissingExternal = missingCats.length === 1 && missingCats[0] === "external"
      if (!(onlyMissingExternal && !hasOutgoing)) {
        const severity = missingCats.includes("external") && hasOutgoing ? "warning" : "info"
        issues.push({
          severity,
          chain, wallet: null,
          code: "missing_categories",
          message: `${chain} is missing categories: ${missingCats.join(", ")}`,
          detail: missingCats.includes("internal")
            ? "Missing internal txs is normal on some L2s"
            : "May indicate incomplete sync — some transfer types weren't fetched",
        })
      }
    }

    if (detail.count > 25 && detail.syncComplete && (detail.directions.in === 0 || detail.directions.out === 0)) {
      const missing = detail.directions.in === 0 ? "incoming" : "outgoing"
      const severity = detail.directions.out === 0 ? "info" : "warning"
      issues.push({
        severity,
        chain, wallet: null,
        code: "one_direction_only",
        message: `${chain} has ${detail.count} txs but zero ${missing} transactions`,
        detail: detail.directions.out === 0
          ? "Receive-only pattern — common for airdrop and token distribution chains"
          : "Either the wallet only sends/receives, or the sync missed one direction",
      })
    }

    if (detail.count < 5 && detail.spanDays && detail.spanDays > 30 && detail.syncComplete) {
      issues.push({
        severity: "warning",
        chain, wallet: null,
        code: "sparse_chain",
        message: `${chain} has only ${detail.count} txs over ${detail.spanDays} days`,
        detail: "Expected more activity — sync may have failed silently or only fetched partial data",
      })
    }

    const latestTs = detail.latest ? Math.floor(new Date(detail.latest).getTime() / 1000) : null
    if (latestTs && (nowSec - latestTs) > 90 * 86400 && detail.count > 10) {
      const daysAgo = Math.round((nowSec - latestTs) / 86400)
      issues.push({
        severity: "info",
        chain, wallet: null,
        code: "stale_chain_data",
        message: `${chain} latest tx is ${daysAgo} days old`,
        detail: "If this wallet is still active on this chain, the sync may not have caught recent transactions",
      })
    }
  }
}

// ── Check 3: Sync state vs DB consistency ──

export function checkSyncDbConsistency(
  issues: QualityIssue[],
  syncStates: Array<{
    chain: string; walletAddress: string; isComplete: boolean; phase: string | null
    lastErrorCode: string | null; recordsInserted: number
  }>,
  perWalletChainCounts: Array<{ walletAddress: string; chain: string; _count: { _all: number } }>,
  wcCountMap: Map<string, number>
) {
  for (const state of syncStates) {
    if (state.phase === "skipped" || state.phase === "needs_key") continue

    const dbCount = state.chain === ZERION_MULTI_CHAIN
      ? perWalletChainCounts
          .filter((wc) => wc.walletAddress === state.walletAddress && wc.chain !== "SOLANA")
          .reduce((sum, wc) => sum + wc._count._all, 0)
      : wcCountMap.get(`${state.walletAddress}:${state.chain}`) ?? 0

    if (state.recordsInserted > 0 && dbCount === 0) {
      issues.push({
        severity: "error",
        chain: state.chain,
        wallet: state.walletAddress,
        code: "sync_vs_db_mismatch",
        message: `${state.chain} sync claims ${state.recordsInserted} inserted but DB has 0 rows for this wallet`,
        detail: "Data may have been deleted without resetting sync state — wipe and restart recommended",
      })
    }

    if (state.isComplete && state.phase === "completed" && state.recordsInserted === 0 && dbCount === 0) {
      issues.push({
        severity: "info",
        chain: state.chain,
        wallet: state.walletAddress,
        code: "empty_sync_completed",
        message: `${state.chain} sync completed but found 0 transactions for ${state.walletAddress.slice(0, 10)}...`,
      })
    }
  }
}

// ── Check 4: Sync health ──

export function checkSyncHealth(
  issues: QualityIssue[],
  syncStates: Array<{
    chain: string; walletAddress: string; isComplete: boolean; phase: string | null
    lastErrorCode: string | null; lastErrorMessage: string | null
    requestsProcessed: number; recordsInserted: number; updatedAt: Date
  }>
) {
  const stuckSyncs = syncStates.filter((s) =>
    !s.isComplete && s.requestsProcessed > 50 && s.recordsInserted === 0
  )
  for (const s of stuckSyncs) {
    issues.push({
      severity: "warning",
      chain: s.chain, wallet: s.walletAddress,
      code: "stuck_sync",
      message: `${s.chain} processed ${s.requestsProcessed} API requests but inserted 0 records`,
      detail: "Sync is running but producing no data — may be fetching empty blocks or hitting errors silently",
    })
  }

  const failedSyncs = syncStates.filter((s) =>
    s.isComplete && s.lastErrorCode && s.phase !== "skipped" && s.phase !== "needs_key" && s.phase !== "completed"
  )
  for (const s of failedSyncs) {
    issues.push({
      severity: "error",
      chain: s.chain, wallet: s.walletAddress,
      code: "failed_sync",
      message: `${s.chain} sync failed: ${s.lastErrorMessage ?? s.lastErrorCode}`,
    })
  }

  const staleThreshold = Date.now() - 24 * 60 * 60 * 1000
  const staleSyncs = syncStates.filter((s) =>
    !s.isComplete && s.updatedAt.getTime() < staleThreshold
  )
  for (const s of staleSyncs) {
    const hoursAgo = Math.round((Date.now() - s.updatedAt.getTime()) / 3600000)
    issues.push({
      severity: "warning",
      chain: s.chain, wallet: s.walletAddress,
      code: "stale_sync",
      message: `${s.chain} sync hasn't progressed in ${hoursAgo} hours (phase: ${s.phase})`,
      detail: "This sync appears abandoned — try restarting or wiping",
    })
  }
}

// ── Check 5: Provider throttle state ──

export function checkProviderThrottles(
  issues: QualityIssue[],
  activeGates: Array<{ provider: string; operationKey: string; consecutive429: number; nextAllowedAt: Date | null }>
) {
  const heavilyThrottled = activeGates.filter((g) => g.consecutive429 > 2)
  if (heavilyThrottled.length > 0) {
    const providers = [...new Set(heavilyThrottled.map((g) => g.provider))]
    const maxConsecutive = Math.max(...heavilyThrottled.map((g) => g.consecutive429))
    issues.push({
      severity: maxConsecutive > 5 ? "error" : "warning",
      chain: null, wallet: null,
      code: "excessive_throttling",
      message: `${heavilyThrottled.length} operations throttled (${providers.join(", ")}), max ${maxConsecutive} consecutive 429s`,
      detail: "High consecutive 429 count means exponential backoff is active — wipe provider gates or add more API keys",
    })
  }

  const futureGates = activeGates.filter((g) => g.nextAllowedAt && g.nextAllowedAt.getTime() > Date.now() + 60_000)
  if (futureGates.length > 0) {
    const maxWait = Math.max(...futureGates.map((g) => g.nextAllowedAt!.getTime())) - Date.now()
    const maxWaitMin = Math.round(maxWait / 60_000)
    issues.push({
      severity: maxWaitMin > 5 ? "warning" : "info",
      chain: null, wallet: null,
      code: "active_backoff",
      message: `${futureGates.length} provider operations have active backoff, longest wait: ${maxWaitMin}min`,
    })
  }
}

// ── Check 6: Wallet coverage ──

export function checkWalletCoverage(
  issues: QualityIssue[],
  wallets: Array<{ address: string }>,
  syncStates: Array<{ chain: string; walletAddress: string }>
) {
  const allSyncChains = new Set([
    ...Object.keys(ALCHEMY_TRANSFER_CHAINS),
    ...Object.keys(ETHERSCAN_SYNC_CHAINS),
    "SOLANA",
  ])

  for (const wallet of wallets) {
    const isSolana = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet.address)
    const normalizedAddr = isSolana ? wallet.address : wallet.address.toLowerCase()
    const walletSyncs = syncStates.filter((s) => s.walletAddress === normalizedAddr)
    const walletChains = new Set(walletSyncs.map((s) => s.chain))

    if (isSolana) {
      if (!walletChains.has("SOLANA")) {
        issues.push({
          severity: "error",
          chain: "SOLANA", wallet: wallet.address,
          code: "missing_sync_state",
          message: `Solana wallet ${wallet.address.slice(0, 8)}... has no SOLANA sync state`,
        })
      }
    } else {
      if (walletChains.has(ZERION_MULTI_CHAIN)) {
        // Covered by Zerion multi-chain sync
      } else {
        const expectedEvmChains = [...allSyncChains].filter((c) => c !== "SOLANA")
        const missingChains = expectedEvmChains.filter((c) => !walletChains.has(c))
        if (missingChains.length > 0) {
          issues.push({
            severity: missingChains.length > 3 ? "warning" : "info",
            chain: null, wallet: wallet.address,
            code: "missing_chain_sync_states",
            message: `Wallet ${wallet.address.slice(0, 10)}... missing sync states for: ${missingChains.join(", ")}`,
            detail: "Run a sync to create these — or they may have been cleaned up",
          })
        }
      }
    }
  }
}
