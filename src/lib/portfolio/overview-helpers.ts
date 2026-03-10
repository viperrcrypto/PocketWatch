/**
 * Pure helper functions and constants for the portfolio overview page.
 * No React or component dependencies — safe to import anywhere.
 */

import type { UTCTimestamp } from "lightweight-charts"
import type {
  NetValueHistoryResponse,
  SyncProgressResponse,
} from "@/hooks/use-portfolio-tracker"

// ─── Constants ───

export const TIMEFRAMES = ["ALL", "1Y", "3M", "1W", "1D"] as const
export type Timeframe = (typeof TIMEFRAMES)[number]

export const CHART_SCOPES = ["total", "onchain"] as const
export type ChartScope = (typeof CHART_SCOPES)[number]

export const NATIVE_CHAIN_MAP: Record<string, string> = {
  ETH: "ETH", AVAX: "AVAX", XDAI: "GNOSIS", POL: "POLYGON_POS",
  BTC: "BTC", SOL: "SOL", MATIC: "POLYGON_POS", BNB: "BSC",
}

export const CAIP_CHAIN_MAP: Record<string, string> = {
  "1": "ETH", "137": "POLYGON_POS", "42161": "ARBITRUM_ONE",
  "10": "OPTIMISM", "8453": "BASE", "43114": "AVAX", "100": "GNOSIS",
}

export const LOCATION_CHAIN_MAP: Record<string, string> = {
  ethereum: "ETH", bitcoin: "BTC", avalanche: "AVAX", gnosis: "GNOSIS",
  polygon_pos: "POLYGON_POS", optimism: "OPTIMISM", arbitrum_one: "ARBITRUM_ONE",
  base: "BASE", bsc: "BSC", solana: "SOL", fantom: "FANTOM", zksync_lite: "ZKSYNC",
  polygon: "POLYGON_POS", xdai: "GNOSIS",
  "binance-smart-chain": "BSC", arbitrum: "ARBITRUM_ONE", "polygon-pos": "POLYGON_POS",
  zksync: "ZKSYNC", linea: "LINEA", scroll: "SCROLL", blast: "BLAST",
  mantle: "MANTLE", mode: "MODE",
  zora: "ZORA", berachain: "BERACHAIN", monad: "MONAD",
  "zksync-era": "ZKSYNC",
}

// ─── Snapshot Parsers ───

export function parseSnapshotData(
  data: unknown,
): { time: UTCTimestamp; value: number; source?: string }[] {
  if (!data) return []
  const payload = data as NetValueHistoryResponse | any
  const sourceData = Array.isArray(payload)
    ? payload
    : (Array.isArray(payload?.points) ? payload.points : payload)
  let times: number[] = []
  let values: number[] = []

  if (
    sourceData?.times && Array.isArray(sourceData.times) &&
    sourceData.data && Array.isArray(sourceData.data)
  ) {
    times = sourceData.times
    values = sourceData.data
  } else if (Array.isArray(sourceData)) {
    return sourceData
      .map((item: any) => ({
        time: (typeof item.timestamp === "number"
          ? item.timestamp
          : Math.floor(new Date(item.timestamp).getTime() / 1000)) as UTCTimestamp,
        value:
          parseFloat(
            String(item.total_value ?? item.total_usd_value ?? item.net_usd ?? 0),
          ) || 0,
        source: item.source as string | undefined,
      }))
      .sort((a: { time: number }, b: { time: number }) => a.time - b.time)
  } else {
    return []
  }

  return times
    .map((ts, i) => ({
      time: ts as UTCTimestamp,
      value:
        typeof values[i] === "string"
          ? parseFloat(values[i] as unknown as string) || 0
          : values[i] || 0,
    }))
    .sort((a, b) => a.time - b.time)
}

export function parseSnapshotMeta(
  data: unknown,
): NetValueHistoryResponse["meta"] | null {
  if (!data || typeof data !== "object") return null
  const maybeMeta = (data as Record<string, unknown>).meta
  if (!maybeMeta || typeof maybeMeta !== "object") return null
  return maybeMeta as NetValueHistoryResponse["meta"]
}

// ─── Asset Parsers ───

/** Parse flat asset map { assetId: { amount, usd_value } } */
export function parseFlatAssets(
  assets: Record<string, any>,
): { asset: string; amount: number; usd_value: number }[] {
  return Object.entries(assets)
    .map(([assetId, balance]) => {
      if (!balance || typeof balance !== "object") return null
      let amt = balance.amount
      let val = balance.usd_value ?? balance.value
      if (amt == null) {
        let totalAmt = 0
        let totalVal = 0
        let found = false
        for (const v of Object.values(balance)) {
          if (v && typeof v === "object" && (v as any).amount != null) {
            totalAmt += parseFloat(String((v as any).amount)) || 0
            totalVal +=
              parseFloat(
                String((v as any).usd_value ?? (v as any).value ?? 0),
              ) || 0
            found = true
          }
        }
        if (found) {
          amt = totalAmt
          val = totalVal
        }
      }
      return {
        asset: assetId,
        amount: parseFloat(String(amt || "0")),
        usd_value: parseFloat(String(val || "0")),
      }
    })
    .filter(
      (a): a is NonNullable<typeof a> => a !== null && a.usd_value > 0,
    )
}

/** Parse per_account format { chain: { "0xaddr": { assets: { id: { amount, usd_value } } } } } */
export function parsePerAccountAssets(
  perAccount: Record<string, any>,
): { asset: string; amount: number; usd_value: number }[] {
  const assetMap: Record<
    string,
    { asset: string; amount: number; usd_value: number }
  > = {}
  for (const [, chainData] of Object.entries(perAccount)) {
    if (!chainData || typeof chainData !== "object") continue
    for (const [, accountData] of Object.entries(
      chainData as Record<string, any>,
    )) {
      const acct = accountData as Record<string, any>
      const acctAssets = acct?.assets || acct
      if (!acctAssets || typeof acctAssets !== "object") continue
      for (const [assetId, bw] of Object.entries(
        acctAssets as Record<string, any>,
      )) {
        if (!bw || typeof bw !== "object") continue
        let amt = parseFloat(String(bw.amount ?? 0)) || 0
        let val = parseFloat(String(bw.usd_value ?? bw.value ?? 0)) || 0
        if (amt === 0 && val === 0) {
          for (const v of Object.values(bw)) {
            if (v && typeof v === "object" && (v as any).amount != null) {
              amt += parseFloat(String((v as any).amount)) || 0
              val +=
                parseFloat(
                  String((v as any).usd_value ?? (v as any).value ?? 0),
                ) || 0
            }
          }
        }
        if (val > 0) {
          if (!assetMap[assetId])
            assetMap[assetId] = { asset: assetId, amount: 0, usd_value: 0 }
          assetMap[assetId].amount += amt
          assetMap[assetId].usd_value += val
        }
      }
    }
  }
  return Object.values(assetMap)
}

// ─── Sync ETA ───

export function estimateSyncEtaMs(
  syncData: SyncProgressResponse | undefined,
): number | null {
  if (!syncData) return null
  const { totalSyncs = 0, processedSyncs = 0, progress = [] } = syncData
  if (totalSyncs === 0) return null
  if (processedSyncs >= totalSyncs) return 0

  const completedRows = progress.filter((r) => r.isComplete)
  const incompleteRows = progress.filter((r) => !r.isComplete)

  let estimatedRemainingReqs: number
  if (completedRows.length > 0) {
    const avgReqsPerSync =
      completedRows.reduce(
        (sum, r) => sum + (r.requestsProcessed ?? 0),
        0,
      ) / completedRows.length
    estimatedRemainingReqs = incompleteRows.length * avgReqsPerSync
  } else {
    const totalDone = progress.reduce(
      (sum, r) => sum + (r.requestsProcessed ?? 0),
      0,
    )
    const pct = syncData.progressPct ?? 0
    if (totalDone === 0 || pct === 0) return null
    estimatedRemainingReqs =
      (totalDone / (pct / 100)) * (1 - pct / 100)
  }

  const REQ_PER_SEC = 2
  const remainingWorkMs = Math.max(
    5_000,
    (estimatedRemainingReqs / REQ_PER_SEC) * 1_000,
  )

  const nextAdvanceMs =
    typeof syncData.nextAdvanceAt === "string"
      ? Date.parse(syncData.nextAdvanceAt)
      : Number.NaN
  if (
    syncData.throttled &&
    Number.isFinite(nextAdvanceMs) &&
    nextAdvanceMs > Date.now()
  ) {
    return nextAdvanceMs - Date.now() + remainingWorkMs
  }
  return remainingWorkMs
}

export function formatEta(ms: number | null): string | null {
  if (ms === null || ms <= 0) return null
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return "< 1m"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `~${minutes}m left`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return `~${hours}h ${remMin}m left`
}
