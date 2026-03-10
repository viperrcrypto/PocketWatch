import type { ExternalServiceVerificationState } from "@/lib/portfolio/verification"
import type {
  ExternalServiceMutationResult,
  ExternalServiceResponseItem,
  SyncProgressResponse,
} from "@/hooks/use-portfolio-tracker"
import { toast } from "sonner"

export const SUPPORTED_SERVICES = [
  {
    id: "zerion",
    label: "Zerion",
    domain: "zerion.io",
    description: "Portfolio balances, staking positions, and price data across 20+ chains",
    keyUrl: "https://zerion.io/api",
  },
  {
    id: "etherscan",
    label: "Etherscan",
    domain: "etherscan.io",
    description: "Transaction history, contract verification, and gas tracker on Ethereum",
    keyUrl: "https://etherscan.io/myapikey",
  },
  {
    id: "coingecko",
    label: "CoinGecko",
    domain: "coingecko.com",
    description: "Token prices, market data, and historical charts",
    keyUrl: "https://www.coingecko.com/en/api/pricing",
  },
  {
    id: "alchemy",
    label: "Alchemy",
    domain: "alchemy.com",
    description: "EVM RPC provider for on-chain reads, NFT data, and token transfers",
    keyUrl: "https://dashboard.alchemy.com/",
  },
  {
    id: "helius",
    label: "Helius",
    domain: "helius.dev",
    description: "Solana RPC and Enhanced Transactions API for wallet history sync",
    keyUrl: "https://dev.helius.xyz/dashboard/app",
  },
  {
    id: "bscscan",
    label: "BscScan",
    domain: "bscscan.com",
    description: "BNB Chain transaction history and contract data",
    keyUrl: "https://bscscan.com/myapikey",
  },
  {
    id: "lineascan",
    label: "LineaScan",
    domain: "lineascan.build",
    description: "Linea transaction history and contract data",
    keyUrl: "https://lineascan.build/myapikey",
  },
  {
    id: "scrollscan",
    label: "ScrollScan",
    domain: "scrollscan.com",
    description: "Scroll transaction history and contract data",
    keyUrl: "https://scrollscan.com/myapikey",
  },
  {
    id: "zksync_explorer",
    label: "zkSync Explorer",
    domain: "era.zksync.network",
    description: "zkSync Era transaction history and contract data",
    keyUrl: "https://era.zksync.network/",
  },
] as const

export const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "CNY", "KRW", "CAD", "AUD", "CHF", "SGD",
  "BTC", "ETH",
] as const

export interface ConfiguredKey {
  id?: string
  api_key: string
  label?: string | null
  verified: boolean
  verificationState: ExternalServiceVerificationState
  verifyError?: string
  consecutive429?: number
}

export function deriveVerificationState(
  explicitState: unknown,
  verified: boolean,
  verifyError?: string | null,
): ExternalServiceVerificationState {
  if (explicitState === "verified" || explicitState === "failed" || explicitState === "unknown") {
    return explicitState
  }
  if (verified) return "verified"
  if (verifyError) return "failed"
  return "unknown"
}

export function getServicesList(data: unknown): ExternalServiceResponseItem[] {
  if (data && typeof data === "object" && Array.isArray((data as { services?: unknown[] }).services)) {
    return (data as { services: ExternalServiceResponseItem[] }).services
  }
  if (
    data
    && typeof data === "object"
    && (data as { result?: unknown }).result
    && Array.isArray(((data as { result?: { services?: unknown[] } }).result?.services))
  ) {
    return (data as { result: { services: ExternalServiceResponseItem[] } }).result.services
  }
  return []
}

export function showVerificationToast(prefix: string, payload: ExternalServiceMutationResult) {
  if (payload.verificationState === "failed") {
    toast.error(`${prefix} Verification failed: ${payload.verifyError || "Unknown error"}`)
    return
  }
  if (payload.verificationState === "unknown") {
    toast.info(`${prefix} Saved, but verification is currently unavailable. Retest in a moment.`)
  }
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "n/a"
  const ts = Date.parse(iso)
  if (!Number.isFinite(ts)) return "n/a"
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  })
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}m ${seconds}s`
  const hours = Math.floor(minutes / 60)
  const remMinutes = minutes % 60
  return `${hours}h ${remMinutes}m`
}

export function estimateSyncEtaMs(syncData: SyncProgressResponse | undefined): number | null {
  if (!syncData) return null
  const { totalSyncs = 0, processedSyncs = 0, progress = [] } = syncData
  if (totalSyncs === 0) return null
  if (processedSyncs >= totalSyncs) return 0

  const completedRows = progress.filter((r) => r.isComplete)
  const incompleteRows = progress.filter((r) => !r.isComplete)

  // Base estimate on actual API requests per completed sync — not wall-clock time,
  // which bakes in all throttle wait time and produces wildly inaccurate estimates.
  let estimatedRemainingReqs: number
  if (completedRows.length > 0) {
    const avgReqsPerSync = completedRows.reduce((sum, r) => sum + (r.requestsProcessed ?? 0), 0) / completedRows.length
    estimatedRemainingReqs = incompleteRows.length * avgReqsPerSync
  } else {
    // No syncs complete yet — use in-progress requests as a proxy
    const totalDone = progress.reduce((sum, r) => sum + (r.requestsProcessed ?? 0), 0)
    const pct = syncData.progressPct ?? 0
    if (totalDone === 0 || pct === 0) return null
    estimatedRemainingReqs = (totalDone / (pct / 100)) * (1 - pct / 100)
  }

  // Sustained throughput: 1 req/sec per key x N keys, with some overhead.
  // Conservative at 2 req/sec to account for backoff and polling gaps.
  const REQ_PER_SEC = 2
  const remainingWorkMs = Math.max(5_000, (estimatedRemainingReqs / REQ_PER_SEC) * 1_000)

  // Throttle wait is added on top — not folded into the work estimate
  const nextAdvanceMs = typeof syncData.nextAdvanceAt === "string"
    ? Date.parse(syncData.nextAdvanceAt) : Number.NaN
  if (syncData.throttled && Number.isFinite(nextAdvanceMs) && nextAdvanceMs > Date.now()) {
    return (nextAdvanceMs - Date.now()) + remainingWorkMs
  }
  return remainingWorkMs
}
