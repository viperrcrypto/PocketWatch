import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { getServiceKey, getAllExchangeCredentials } from "@/lib/portfolio/service-keys"
import { getRefreshMeta } from "@/lib/portfolio/refresh-orchestrator"
import {
  type ChartPoint,
  MAX_FUTURE_SKEW_SEC,
  normalizeRange, normalizeScope, normalizeFormat, toIso,
  sanitizeZerionSeries, getSnapshotWalletFingerprint,
  onchainValueFromSnapshot, applyRange, isZerionLowConfidence,
  hasUsableReconstructedHistory, interpolateSparseGaps,
  buildWalletFingerprint, getNormalizedAddresses,
  safeScaleReference, isProjectedChartFlat,
  SCALE_FACTOR_MIN, SCALE_FACTOR_MAX,
} from "@/lib/portfolio/snapshot-helpers"
import {
  refreshZerionCache, fetchRangeSpecificZerion, smoothZerionPoints,
  buildSnapshotPoints, mergeChartSeries, mergeWithProjectedChart, computeOnchainRef,
  normalizeZerionToRef, handleLowConfidenceZerion, blendExchangeBalances,
  computeStatusAndWarning, triggerSyncIfNeeded,
  computeCoverageInfo, pruneAndNormalize, purgeSnapshotData,
  fetchProjectedChart,
} from "@/lib/portfolio/snapshot-data-pipeline"

/** GET /api/portfolio/history/snapshots — return net value history. */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  const { searchParams } = new URL(request.url)
  const range = normalizeRange(searchParams.get("range"))
  const scope = normalizeScope(searchParams.get("scope"))
  const format = normalizeFormat(searchParams.get("format"))
  const debug = searchParams.get("debug") === "true"

  try {
    const [zerionKey, wallets, cachedChartRows, snapshots, portfolioSetting, transactionCount, exchangeCredentials] = await Promise.all([
      getServiceKey(user.id, "zerion"),
      db.trackedWallet.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      db.chartCache.findMany({ where: { userId: user.id }, orderBy: { timestamp: "asc" } }),
      db.portfolioSnapshot.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      db.portfolioSetting.findUnique({ where: { userId: user.id }, select: { settings: true } }),
      db.transactionCache.count({ where: { userId: user.id } }),
      getAllExchangeCredentials(user.id),
    ])

    const hasExchangeAccounts = exchangeCredentials.length > 0
    const liveRefreshCount = snapshots.filter((s) => s.source === "live_refresh").length
    const effectiveScope = scope === "total" && (!hasExchangeAccounts || liveRefreshCount === 0) ? "onchain" : scope

    const nowSec = Math.floor(Date.now() / 1000)
    const futureCutoff = nowSec + MAX_FUTURE_SKEW_SEC
    const addresses = wallets.map((w) => w.address)
    const normalizedAddresses = getNormalizedAddresses(addresses)
    const walletFingerprint = buildWalletFingerprint(addresses)

    const [syncStates, walletCoverageRows] = await Promise.all([
      db.transactionSyncState.findMany({
        where: { userId: user.id },
        select: { walletAddress: true, updatedAt: true, isComplete: true },
      }),
      normalizedAddresses.length > 0
        ? db.transactionCache.groupBy({
            by: ["walletAddress"],
            where: { userId: user.id, walletAddress: { in: normalizedAddresses } },
            _min: { blockTimestamp: true },
          })
        : Promise.resolve([]),
    ])

    const { strictCoverageStartSec, incompleteSyncCount } =
      computeCoverageInfo(normalizedAddresses, walletCoverageRows, syncStates, wallets.length)

    const settingsObject = portfolioSetting?.settings && typeof portfolioSetting.settings === "object"
      ? (portfolioSetting.settings as Record<string, unknown>)
      : {}

    // If chart was just wiped, return empty data — don't re-fetch from Zerion
    if (typeof settingsObject.chartWipedAt === "string") {
      if (format === "legacy") return NextResponse.json([])
      return NextResponse.json({
        points: [],
        meta: {
          scope, effectiveScope, range, status: "ready" as const,
          coverageStart: null, coverageEnd: null, incompleteSyncCount: 0, warningCode: null,
        },
      })
    }

    const previousFingerprint = typeof settingsObject.chartWalletFingerprint === "string"
      ? settingsObject.chartWalletFingerprint : ""

    let zerionPoints = sanitizeZerionSeries(
      cachedChartRows.filter((r) => r.timestamp <= futureCutoff).map((r) => ({ timestamp: r.timestamp, value: r.value, source: "zerion" })),
      nowSec
    )

    const staleIds = snapshots.filter((s) => {
      if (s.source !== "reconstructed") return false
      const fp = getSnapshotWalletFingerprint(s.metadata)
      return !fp || fp !== walletFingerprint
    }).map((s) => s.id)

    zerionPoints = await refreshZerionCache({
      userId: user.id, zerionKey, addresses, zerionPoints, nowSec,
      previousFingerprint, walletFingerprint,
      staleReconstructedSnapshotIds: staleIds,
      futureRows: cachedChartRows.filter((r) => r.timestamp > futureCutoff),
    })

    let rangeSpecific = await fetchRangeSpecificZerion({ range, zerionKey, addresses, userId: user.id, walletFingerprint, nowSec })
    const smoothed = await smoothZerionPoints({
      zerionPoints, rangeSpecificZerionPoints: rangeSpecific,
      userId: user.id, normalizedAddresses, hasRangeOverride: rangeSpecific.length > 0,
    })
    zerionPoints = smoothed.zerionPoints
    rangeSpecific = smoothed.rangeSpecificZerionPoints

    const snapshotMergePoints = buildSnapshotPoints({ snapshots, effectiveScope, walletFingerprint, nowSec, cachedChartRows, zerionPoints })
    const { onchainRefPoint, latestLiveSnapshot, reconstructedPoints, matchingLiveSnapshots } =
      computeOnchainRef({ snapshots, walletFingerprint, snapshotMergePoints })

    // Fetch projected chart in parallel with prune/normalize (non-blocking)
    const projectedChartPromise = fetchProjectedChart({
      userId: user.id, zerionKey, addresses, walletFingerprint, nowSec,
    }).catch((err) => {
      console.warn("[snapshots] Projected chart failed (non-fatal):", err)
      return [] as ChartPoint[]
    })

    zerionPoints = await pruneAndNormalize({ userId: user.id, zerionPoints, onchainRefPoint, reconstructedPoints, latestLiveSnapshot })
    const projectedPoints = await projectedChartPromise

    // Skip projected merge when chart is flat (stablecoin-heavy DeFi portfolio).
    // A flat projection produces bad blend values since it's constant.
    const projectedIsFlat = isProjectedChartFlat(projectedPoints)

    const liveRef = onchainRefPoint ?? latestLiveSnapshot

    if (projectedPoints.length > 0 && zerionPoints.length > 0 && !projectedIsFlat) {
      // Projected chart has meaningful variance (volatile DeFi assets) —
      // force-scale Zerion to match live reference and blend-merge.
      const ref = onchainRefPoint ?? latestLiveSnapshot
      if (ref && ref.value > 0) {
        const safeRef = safeScaleReference(zerionPoints)
        if (safeRef > 0) {
          const ratio = ref.value / safeRef
          if (Math.abs(ratio - 1) > 0.05 && ratio >= SCALE_FACTOR_MIN && ratio <= SCALE_FACTOR_MAX && Number.isFinite(ratio)) {
            zerionPoints = zerionPoints.map((p) => ({ ...p, value: p.value * ratio }))
          }
        }
      }
      // Cap projected outliers: any point > 5x live reference is likely stale DeFi
      // position data. Clamp to the live reference to prevent chart spikes.
      const projCapRef = liveRef?.value ?? 0
      const projectedCapped = projCapRef > 0
        ? projectedPoints.map((p) => p.value > projCapRef * 5 ? { ...p, value: projCapRef } : p)
        : projectedPoints
      zerionPoints = mergeWithProjectedChart(zerionPoints, projectedCapped)
    } else if (projectedPoints.length > 0 && projectedIsFlat && zerionPoints.length > 0) {
      // Flat projected chart = stablecoin-heavy DeFi portfolio.
      // Zerion chart only shows wallet remnants (not protocol-deposited value).
      // Suppress Zerion only if we have reconstructed/live snapshots as a backbone.
      const hasSnapshotBackbone = snapshotMergePoints.some(
        (p) => p.source === "live_refresh" || p.source === "reconstructed",
      )
      if (hasSnapshotBackbone) {
        console.info(`[snapshots] Flat projected chart (stablecoin-heavy DeFi) — suppressing Zerion, using snapshot backbone`)
        zerionPoints = []
      }
      // else: keep Zerion — partial data is better than no data
    } else {
      // No projected data — fall back to confidence-based handling
      const confidenceRef = onchainRefPoint ?? latestLiveSnapshot ?? (reconstructedPoints.length > 0 ? reconstructedPoints[reconstructedPoints.length - 1] : undefined)
      const zerionLowConfidence = isZerionLowConfidence(zerionPoints, confidenceRef)
      zerionPoints = normalizeZerionToRef({ zerionPoints, rangeSpecificZerionPoints: rangeSpecific, onchainRefPoint, zerionLowConfidence })
      if (zerionLowConfidence) {
        zerionPoints = await handleLowConfidenceZerion({
          userId: user.id, walletFingerprint, settingsObject, transactionCount,
          usableReconstructed: hasUsableReconstructedHistory(reconstructedPoints, latestLiveSnapshot),
        })
      }
    }

    const merged = mergeChartSeries({ zerionPoints, snapshotMergePoints, latestLiveSnapshot })

    let strictPoints = merged
    if (effectiveScope === "onchain") {
      if (strictCoverageStartSec !== null) {
        strictPoints = merged.filter((p) => p.timestamp >= strictCoverageStartSec)
      } else {
        // No full tx coverage yet — include reconstructed alongside live_refresh
        // (reconstructed is derived from on-chain tx data, safe to show)
        const hasReconstructed = merged.some((p) => p.source === "reconstructed")
        strictPoints = hasReconstructed
          ? merged.filter((p) => p.source === "live_refresh" || p.source === "reconstructed")
          : merged.filter((p) => p.source === "live_refresh")
      }
    }
    if (effectiveScope === "total") {
      strictPoints = await blendExchangeBalances({ userId: user.id, merged, matchingLiveSnapshots, onchainValueFromSnapshot })
    }

    const ranged = applyRange(strictPoints, range, nowSec)
    const interpolated = range === "1D" ? ranged : interpolateSparseGaps(ranged)
    const points = interpolated.map((p) => ({ timestamp: p.timestamp, total_value: p.value, total_usd_value: p.value, source: p.source }))

    const { status, warningCode } = computeStatusAndWarning({
      effectiveScope, strictCoverageStartSec, incompleteSyncCount, strictPointsLength: strictPoints.length, range,
    })

    await triggerSyncIfNeeded({ userId: user.id, wallets, syncStates, normalizedAddresses })

    if (format === "legacy") return NextResponse.json(points)

    const refreshMeta = await getRefreshMeta(user.id)
    const coverageStartSec = strictPoints.length > 0 ? strictPoints[0].timestamp : strictCoverageStartSec
    const coverageEndSec = strictPoints.length > 0 ? strictPoints[strictPoints.length - 1].timestamp : null

    const baseMeta = { scope, effectiveScope, range, status, coverageStart: toIso(coverageStartSec), coverageEnd: toIso(coverageEndSec), incompleteSyncCount, warningCode, ...refreshMeta }

    if (debug) {
      const sourceCounts: Record<string, number> = {}
      let minValue = Infinity
      let maxValue = -Infinity
      for (const p of points) {
        sourceCounts[p.source] = (sourceCounts[p.source] ?? 0) + 1
        if (p.total_value < minValue) minValue = p.total_value
        if (p.total_value > maxValue) maxValue = p.total_value
      }

      // Exchange blend info from blendExchangeBalances
      const exchangeSnapshots = snapshots.filter((s) => s.source === "exchange_balance")
      const firstExchange = exchangeSnapshots.length > 0 ? exchangeSnapshots[0].createdAt : null
      const lastExchange = exchangeSnapshots.length > 0 ? exchangeSnapshots[exchangeSnapshots.length - 1].createdAt : null

      return NextResponse.json({
        points,
        meta: baseMeta,
        debug: {
          totalPoints: points.length,
          sourceCounts,
          valueRange: points.length > 0 ? { min: minValue, max: maxValue } : null,
          dateRange: points.length > 0
            ? { first: toIso(points[0].timestamp), last: toIso(points[points.length - 1].timestamp) }
            : null,
          exchange: {
            snapshotCount: exchangeSnapshots.length,
            firstDate: firstExchange ? toIso(Math.floor(firstExchange.getTime() / 1000)) : null,
            lastDate: lastExchange ? toIso(Math.floor(lastExchange.getTime() / 1000)) : null,
          },
        },
      })
    }

    return NextResponse.json({ points, meta: baseMeta })
  } catch (error) {
    return apiError("E9091", "Failed to load snapshot history", 500, error)
  }
}

/** POST /api/portfolio/history/snapshots — manually save a snapshot */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9092", "Authentication required", 401)
  return NextResponse.json({ success: true, message: "Snapshots are saved automatically on balance refresh." })
}

/** DELETE /api/portfolio/history/snapshots — purge all chart/snapshot data for re-sync */
export async function DELETE() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9093", "Authentication required", 401)

  try {
    const purged = await purgeSnapshotData(user.id)
    console.log(
      `[snapshots] Purged data for user ${user.id}: ` +
      `${purged.snapshots} snapshots, ${purged.chartCache} chart cache rows, ${purged.syncStates} sync states, ` +
      `${purged.historyJobsReset} active sync jobs reset`
    )
    return NextResponse.json({ success: true, purged })
  } catch (error) {
    return apiError("E9094", "Failed to purge snapshot data", 500, error)
  }
}
