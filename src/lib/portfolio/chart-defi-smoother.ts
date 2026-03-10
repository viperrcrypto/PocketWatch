/**
 * Chart DeFi Dip Smoother.
 *
 * Detects artificial dips in chart data caused by DeFi interactions
 * (deposits to Aave, swaps on Uniswap, etc.) where wallet balance drops
 * but the DeFi position value hasn't been captured in the same data point.
 *
 * Uses two complementary strategies:
 * 1. Adaptive windowed anomaly detection (statistical)
 * 2. Transaction-context correlation (semantic — cross-references with TransactionCache)
 */

import { db } from "@/lib/db"

export interface ChartPoint {
  timestamp: number
  value: number
  source: string
}

interface DipCandidate {
  index: number
  point: ChartPoint
  dropPct: number
  rollingMedian: number
  recoversWithin: number
}

/**
 * Detect transient dips using rolling median + recovery window.
 * A "transient dip" is a point that:
 *   - Drops >15% from the rolling median
 *   - Recovers to within 10% of the pre-dip level within `recoveryWindow` points
 */
function detectTransientDips(
  points: ChartPoint[],
  windowSize: number = 5,
  dropThreshold: number = 0.15,
  recoveryWindow: number = 3
): DipCandidate[] {
  if (points.length < windowSize + 2) return []

  const dips: DipCandidate[] = []

  for (let i = 1; i < points.length - 1; i++) {
    // Skip already-interpolated/smoothed points
    if (points[i].source === "interpolated" || points[i].source === "smoothed") continue

    // Build rolling median from preceding points
    const windowStart = Math.max(0, i - windowSize)
    const window = points.slice(windowStart, i).map((p) => p.value)
    if (window.length < 2) continue

    const sorted = [...window].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (median <= 0) continue

    const curr = points[i].value
    const dropPct = (median - curr) / median

    // Must be a significant drop
    if (dropPct < dropThreshold) continue

    // Check recovery: does value return to within 10% of median within N points?
    let recoversWithin = -1
    for (let j = 1; j <= recoveryWindow && i + j < points.length; j++) {
      const futureValue = points[i + j].value
      const recoveryRatio = Math.abs(futureValue - median) / median
      if (recoveryRatio < 0.10) {
        recoversWithin = j
        break
      }
    }

    if (recoversWithin > 0) {
      dips.push({
        index: i,
        point: points[i],
        dropPct,
        rollingMedian: median,
        recoversWithin,
      })
    }
  }

  return dips
}

/**
 * Check if a dip is correlated with DeFi transactions.
 * Looks for outflows to contracts in the same time window where:
 *   - Same txHash has both in+out transfers (swap/deposit pattern)
 *   - Or outflow to a non-wallet address (protocol interaction)
 */
async function correlateWithTransactions(
  userId: string,
  dips: DipCandidate[],
  walletAddresses: string[]
): Promise<Set<number>> {
  if (dips.length === 0 || walletAddresses.length === 0) return new Set()

  const confirmedDipIndices = new Set<number>()

  // Batch-query all transactions in the time range covering all dips
  const minTs = Math.min(...dips.map((d) => d.point.timestamp)) - 7200 // 2h before
  const maxTs = Math.max(...dips.map((d) => d.point.timestamp)) + 7200 // 2h after

  const transactions = await db.transactionCache.findMany({
    where: {
      userId,
      walletAddress: { in: walletAddresses },
      blockTimestamp: { gte: minTs, lte: maxTs },
      category: { in: ["external", "erc20"] },
    },
    select: {
      txHash: true,
      blockTimestamp: true,
      direction: true,
      value: true,
      usdValue: true,
      to: true,
      from: true,
      txClassification: true,
    },
    orderBy: { blockTimestamp: "asc" },
  })

  if (transactions.length === 0) return confirmedDipIndices

  // Group transactions by txHash to detect swap/deposit patterns
  const txByHash = new Map<string, typeof transactions>()
  for (const tx of transactions) {
    const existing = txByHash.get(tx.txHash) ?? []
    existing.push(tx)
    txByHash.set(tx.txHash, existing)
  }

  // Find txHashes that have both in+out (swap/deposit pattern)
  const defiTxHashes = new Set<string>()
  for (const [hash, txs] of txByHash) {
    const hasIn = txs.some((tx) => tx.direction === "in")
    const hasOut = txs.some((tx) => tx.direction === "out")
    if (hasIn && hasOut) {
      defiTxHashes.add(hash)
    }
  }

  // For each dip, check if there's a correlated DeFi transaction
  const walletSet = new Set(walletAddresses.map((a) => a.toLowerCase()))

  for (const dip of dips) {
    const dipTs = dip.point.timestamp
    const windowStart = dipTs - 7200 // 2h window
    const windowEnd = dipTs + 7200

    const nearbyTxs = transactions.filter(
      (tx) => tx.blockTimestamp >= windowStart && tx.blockTimestamp <= windowEnd
    )

    // Strategy 1: Same-hash in+out pattern
    const hasDefiPattern = nearbyTxs.some((tx) => defiTxHashes.has(tx.txHash))

    // Strategy 2: Check if nearby transactions are classified as internal_transfer or swap
    // This is a high-confidence signal — the classifier already verified protocol interactions
    const hasClassifiedNeutral = nearbyTxs.some((tx) => {
      return tx.txClassification === "internal_transfer" || tx.txClassification === "swap"
    })

    if (hasDefiPattern || hasClassifiedNeutral) {
      confirmedDipIndices.add(dip.index)
    }
  }

  return confirmedDipIndices
}

/**
 * Interpolate through dip points by linearly blending between
 * the last stable point before and the first stable point after.
 */
function interpolateDips(
  points: ChartPoint[],
  dipIndices: Set<number>
): ChartPoint[] {
  if (dipIndices.size === 0) return points

  const result: ChartPoint[] = []

  for (let i = 0; i < points.length; i++) {
    if (!dipIndices.has(i)) {
      result.push(points[i])
      continue
    }

    // Find the last non-dip point before this one
    let prevIdx = i - 1
    while (prevIdx >= 0 && dipIndices.has(prevIdx)) prevIdx--

    // Find the next non-dip point after this one
    let nextIdx = i + 1
    while (nextIdx < points.length && dipIndices.has(nextIdx)) nextIdx++

    if (prevIdx < 0 || nextIdx >= points.length) {
      // Can't interpolate at edges — keep original
      result.push(points[i])
      continue
    }

    const prev = points[prevIdx]
    const next = points[nextIdx]
    const totalGap = next.timestamp - prev.timestamp
    if (totalGap <= 0) {
      result.push(points[i])
      continue
    }

    const ratio = (points[i].timestamp - prev.timestamp) / totalGap
    result.push({
      timestamp: points[i].timestamp,
      value: prev.value + (next.value - prev.value) * ratio,
      source: "smoothed",
    })
  }

  return result
}

/**
 * Detect sustained dips: drops >15% from rolling median that do NOT recover
 * within the recovery window. These represent DeFi position entries where
 * Zerion only tracks wallet-held assets, not protocol-deposited value.
 *
 * For each sustained dip, we use the pre-dip value as a floor.
 */
function detectSustainedDefiDips(
  points: ChartPoint[],
  windowSize: number = 5,
  dropThreshold: number = 0.15,
  recoveryWindow: number = 3,
): DipCandidate[] {
  if (points.length < windowSize + 2) return []

  const dips: DipCandidate[] = []

  for (let i = 1; i < points.length - 1; i++) {
    if (points[i].source === "interpolated" || points[i].source === "smoothed") continue

    const windowStart = Math.max(0, i - windowSize)
    const window = points.slice(windowStart, i).map((p) => p.value)
    if (window.length < 2) continue

    const sorted = [...window].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    if (median <= 0) continue

    const curr = points[i].value
    const dropPct = (median - curr) / median

    if (dropPct < dropThreshold) continue

    // Check that it does NOT recover — this distinguishes sustained from transient
    let recovers = false
    for (let j = 1; j <= recoveryWindow && i + j < points.length; j++) {
      const futureValue = points[i + j].value
      const recoveryRatio = Math.abs(futureValue - median) / median
      if (recoveryRatio < 0.10) {
        recovers = true
        break
      }
    }

    // Only include non-recovering dips
    if (!recovers) {
      dips.push({ index: i, point: points[i], dropPct, rollingMedian: median, recoversWithin: -1 })
    }
  }

  return dips
}

/**
 * Apply sustained dip correction: replace dip values with the pre-dip level
 * (rolling median) when the dip is confirmed as DeFi-related via tx correlation.
 */
function applySustainedDipCorrection(
  points: ChartPoint[],
  confirmedIndices: Set<number>,
  dips: DipCandidate[],
): ChartPoint[] {
  const dipMap = new Map(dips.map((d) => [d.index, d]))
  return points.map((point, i) => {
    if (!confirmedIndices.has(i)) return point
    const dip = dipMap.get(i)
    if (!dip) return point
    // Use the pre-dip median as the floor value
    return { ...point, value: dip.rollingMedian, source: "smoothed" }
  })
}

/**
 * Main entry point: smooth DeFi dips in chart data.
 *
 * 1. Detect transient dips using adaptive rolling median
 * 2. Optionally correlate with transaction data for higher confidence
 * 3. Interpolate through confirmed transient dip points
 * 4. Detect and correct sustained DeFi dips (non-recovering)
 *
 * @param points - Chart points (sorted by timestamp ascending)
 * @param userId - User ID for transaction correlation (optional)
 * @param walletAddresses - User's tracked wallet addresses (optional)
 * @returns Smoothed chart points
 */
export async function smoothDefiDips(
  points: ChartPoint[],
  userId?: string,
  walletAddresses?: string[],
): Promise<ChartPoint[]> {
  if (points.length < 5) return points

  // Step 1: Statistical detection of transient dips
  const transientDips = detectTransientDips(points)

  let result = points

  if (transientDips.length > 0) {
    let confirmedTransient: Set<number>

    // Step 2: Transaction correlation (if user context available)
    if (userId && walletAddresses && walletAddresses.length > 0) {
      const txConfirmed = await correlateWithTransactions(userId, transientDips, walletAddresses)
      const strongDips = new Set(
        transientDips
          .filter((d) => d.dropPct > 0.25 && d.recoversWithin <= 2)
          .map((d) => d.index)
      )
      confirmedTransient = new Set([...txConfirmed, ...strongDips])
    } else {
      confirmedTransient = new Set(
        transientDips
          .filter((d) => d.dropPct > 0.25 && d.recoversWithin <= 2)
          .map((d) => d.index)
      )
    }

    // Step 3: Interpolate transient dips
    if (confirmedTransient.size > 0) {
      result = interpolateDips(result, confirmedTransient)
    }
  }

  // Step 4: Detect sustained DeFi dips (non-recovering drops correlated with DeFi txs)
  if (userId && walletAddresses && walletAddresses.length > 0) {
    const sustainedDips = detectSustainedDefiDips(result)
    if (sustainedDips.length > 0) {
      const sustainedConfirmed = await correlateWithTransactions(userId, sustainedDips, walletAddresses)
      if (sustainedConfirmed.size > 0) {
        result = applySustainedDipCorrection(result, sustainedConfirmed, sustainedDips)
      }
    }
  }

  return result
}
