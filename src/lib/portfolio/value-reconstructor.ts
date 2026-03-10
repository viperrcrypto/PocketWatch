/**
 * Portfolio value reconstructor.
 * Walks through cached transactions chronologically, maintains token balances,
 * and samples portfolio value at daily intervals to create PortfolioSnapshot
 * records with source "reconstructed".
 */

import { db } from "@/lib/db"
import {
  resolveUnpricedTransactions,
  inferHeuristicUsdPrice,
  isLikelySpamTokenSymbol,
  isPlausibleResolvedPrice,
} from "./price-resolver"
import { fetchNativeTokenPrices } from "@/lib/tracker/chains"
import { normalizeWalletAddress } from "./utils"
import { filterValidPoints } from "./snapshot-validation"
import type { ChartPoint } from "./snapshot-helpers"

const DAY_SECONDS = 86400

/**
 * Reconstruct daily portfolio value history from cached transactions.
 * 1. Resolve any unpriced transactions via DeFiLlama
 * 2. Walk forward through all transactions maintaining balance map
 * 3. Sample portfolio value at daily intervals
 * 4. Store as PortfolioSnapshot with source "reconstructed"
 *
 * Returns the number of new snapshots created.
 */
export async function reconstructPortfolioHistory(userId: string): Promise<{
  snapshotsCreated: number
  priceResolution: { resolved: number; failed: number; total: number }
}> {
  // Step 1: Resolve prices for any unpriced transactions
  const priceResolution = await resolveUnpricedTransactions(userId)
  console.log(`[reconstructor] Price resolution: ${priceResolution.resolved} resolved, ${priceResolution.failed} failed`)

  const trackedWallets = await db.trackedWallet.findMany({
    where: { userId },
    select: { address: true },
  })
  // EVM addresses are stored lowercase in TransactionCache; Solana are case-sensitive (base58).
  // Normalize so queries match what's actually in the DB.
  const walletAddresses = trackedWallets
    .map((wallet) => normalizeWalletAddress(wallet.address))
    .sort((a, b) => a.localeCompare(b))

  if (walletAddresses.length === 0) {
    await db.portfolioSnapshot.deleteMany({
      where: { userId, source: "reconstructed" },
    })
    return { snapshotsCreated: 0, priceResolution }
  }

  // Step 2: Fetch all transactions and collapse into per-tx net asset movements.
  // Skip net-worth-neutral transactions (internal_transfer, swap) when classified.
  const NET_WORTH_NEUTRAL_CLASSIFICATIONS = new Set(["internal_transfer", "swap", "gas", "spam"])

  const rawTransactions = await db.transactionCache.findMany({
    where: {
      userId,
      walletAddress: { in: walletAddresses },
      category: { in: ["external", "erc20"] },
      value: { not: null },
    },
    select: {
      txHash: true,
      chain: true,
      asset: true,
      symbol: true,
      blockTimestamp: true,
      value: true,
      usdValue: true,
      direction: true,
      txClassification: true,
    },
    orderBy: { blockTimestamp: "asc" },
  })

  const nativePrices = await fetchNativeTokenPrices().catch(() => new Map<string, number>())

  if (rawTransactions.length === 0) {
    await db.portfolioSnapshot.deleteMany({
      where: { userId, source: "reconstructed" },
    })
    return { snapshotsCreated: 0, priceResolution }
  }

  type NetEvent = {
    chain: string
    asset: string
    symbol: string | null
    blockTimestamp: number
    netAmount: number
    priceNumerator: number
    priceDenominator: number
  }

  const eventsByKey = new Map<string, NetEvent>()
  for (const tx of rawTransactions) {
    if (isLikelySpamTokenSymbol(tx.symbol)) continue

    // Skip unidentified token transfers — no symbol and no USD value means
    // no useful data; including them creates phantom balances.
    if (!tx.symbol && (tx.usdValue === null || tx.usdValue === 0)) continue

    // Skip classified net-worth-neutral transactions.
    // These include DeFi deposits/withdrawals, swaps, gas, and spam.
    // Unclassified transactions (txClassification === null) are processed normally
    // to preserve backward compatibility.
    if (tx.txClassification && NET_WORTH_NEUTRAL_CLASSIFICATIONS.has(tx.txClassification)) {
      continue
    }

    const asset = tx.asset ?? "native"
    const eventKey = `${tx.chain}:${tx.txHash}:${asset}`
    const existing = eventsByKey.get(eventKey) ?? {
      chain: tx.chain,
      asset,
      symbol: tx.symbol,
      blockTimestamp: tx.blockTimestamp,
      netAmount: 0,
      priceNumerator: 0,
      priceDenominator: 0,
    }

    const amount = tx.value ?? 0
    const signedAmount = tx.direction === "in" ? amount : -amount
    existing.netAmount += signedAmount
    if (!existing.symbol && tx.symbol) existing.symbol = tx.symbol

    if (tx.usdValue !== null && amount > 0) {
      const impliedPrice = Math.abs(tx.usdValue) / Math.abs(amount)
      if (isPlausibleResolvedPrice(tx.symbol, tx.chain, impliedPrice, nativePrices)) {
        existing.priceNumerator += Math.abs(tx.usdValue)
        existing.priceDenominator += Math.abs(amount)
      }
    }

    eventsByKey.set(eventKey, existing)
  }

  const transactions = Array.from(eventsByKey.values())
    .filter((event) => Math.abs(event.netAmount) > 0)
    .sort((a, b) => a.blockTimestamp - b.blockTimestamp)

  if (transactions.length === 0) {
    return { snapshotsCreated: 0, priceResolution }
  }

  // Step 3: Walk forward, maintaining balances and sampling daily
  const balances = new Map<string, number>()     // "chain:asset" → token balance
  const lastPrice = new Map<string, number>()     // "chain:asset" → latest USD price per token

  const firstTs = transactions[0].blockTimestamp
  const lastTs = transactions[transactions.length - 1].blockTimestamp
  const nowTs = Math.floor(Date.now() / 1000)

  // Pre-compute daily sample timestamps
  const sampleStart = Math.floor(firstTs / DAY_SECONDS) * DAY_SECONDS
  const sampleEnd = Math.min(lastTs + DAY_SECONDS, nowTs)

  let txIdx = 0
  const dailyValues: Array<{ timestamp: number; value: number }> = []

  for (let day = sampleStart; day <= sampleEnd; day += DAY_SECONDS) {
    const dayEnd = day + DAY_SECONDS

    // Process all transactions up to this day boundary
    while (txIdx < transactions.length && transactions[txIdx].blockTimestamp < dayEnd) {
      const tx = transactions[txIdx]
      const key = `${tx.chain}:${tx.asset}`

      const currentBalance = balances.get(key) ?? 0
      const amount = tx.netAmount

      balances.set(key, currentBalance + amount)

      // Track latest price for this asset
      const effectivePrice =
        tx.priceDenominator > 0
          ? tx.priceNumerator / tx.priceDenominator
          : inferHeuristicUsdPrice(tx.symbol, tx.chain, nativePrices)

      if (
        effectivePrice !== null &&
        effectivePrice > 0 &&
        isPlausibleResolvedPrice(tx.symbol, tx.chain, effectivePrice, nativePrices)
      ) {
        lastPrice.set(key, effectivePrice)
      }

      txIdx++
    }

    // Sample: sum(balance * lastKnownPrice) for tokens with positive balance
    // (negative balances indicate data quality issues — skip rather than zeroing)
    let totalValue = 0
    for (const [key, balance] of balances) {
      if (balance <= 0) continue
      const price = lastPrice.get(key)
      if (price && price > 0) {
        totalValue += balance * price
      }
    }

    if (totalValue > 0) {
      dailyValues.push({ timestamp: day, value: totalValue })
    }
  }

  if (dailyValues.length === 0) {
    return { snapshotsCreated: 0, priceResolution }
  }

  // Step 3a: Supplement with DeFi position values from the projected chart.
  // The projected chart tracks current positions backward — for stablecoin-heavy
  // DeFi portfolios, it's flat (~$153k) but that IS the correct historical value.
  // We detect when DeFi deposits started (>30% drop from running peak) and use
  // the projected value as a floor from that point forward.
  const projectedCache = await db.projectedChartCache.findMany({
    where: { userId },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, value: true },
  })

  if (projectedCache.length > 0) {
    const projectedByDay = new Map<number, number>()
    for (const p of projectedCache) {
      const day = Math.floor(p.timestamp / DAY_SECONDS) * DAY_SECONDS
      projectedByDay.set(day, Math.max(projectedByDay.get(day) ?? 0, p.value))
    }

    // Detect DeFi deposit start: first day where value drops >25% below
    // its running peak AND projected exceeds reconstructed.
    // Before that point, the user hadn't deposited into DeFi yet,
    // so reconstructed values are accurate.
    //
    // Once activated, ramp up smoothly over RAMP_DAYS to avoid a jarring
    // jump from wallet-only value to projected DeFi value.
    const RAMP_DAYS = 5
    let runningMax = 0
    let defiFloorActivated = false
    let rampStartIdx: number | null = null
    let rampStartValue = 0
    for (let i = 0; i < dailyValues.length; i++) {
      const dv = dailyValues[i]
      if (dv.value > runningMax) runningMax = dv.value
      const projected = projectedByDay.get(dv.timestamp)
      if (!projected) continue

      if (!defiFloorActivated && runningMax > 0 && dv.value < runningMax * 0.75 && projected > dv.value) {
        defiFloorActivated = true
      }
      if (defiFloorActivated && projected > dv.value) {
        if (rampStartIdx === null) {
          rampStartIdx = i
          rampStartValue = dv.value
        }
        const daysSinceActivation = i - rampStartIdx
        if (daysSinceActivation < RAMP_DAYS) {
          // Smooth ramp from pre-floor value to projected value
          const rampRatio = (daysSinceActivation + 1) / RAMP_DAYS
          const ramped = rampStartValue + (projected - rampStartValue) * rampRatio
          dailyValues[i] = { ...dv, value: ramped }
        } else {
          dailyValues[i] = { ...dv, value: projected }
        }
      }
    }
  }

  // Step 3b: Anchor reconstruction to live_refresh snapshots as ground truth.
  // If we have live snapshots in the same time range, use them to calibrate
  // the reconstructed values by scaling segments between anchor points.
  const liveSnapshots = await db.portfolioSnapshot.findMany({
    where: {
      userId,
      source: "live_refresh",
      createdAt: {
        gte: new Date(dailyValues[0].timestamp * 1000),
        lte: new Date((dailyValues[dailyValues.length - 1].timestamp + DAY_SECONDS) * 1000),
      },
    },
    select: { totalValue: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  if (liveSnapshots.length > 0) {
    // Build anchor map: timestamp → known good value
    const anchors = liveSnapshots
      .filter((s) => s.totalValue > 0)
      .map((s) => ({
        timestamp: Math.floor(s.createdAt.getTime() / 1000),
        value: s.totalValue,
      }))

    if (anchors.length > 0) {
      // Compute scale factors at each anchor point, validating each anchor
      const anchorScales: Array<{ timestamp: number; scale: number }> = []
      for (const anchor of anchors) {
        // Find the closest daily value to this anchor
        let closestDv: (typeof dailyValues)[0] | null = null
        let closestDist = Infinity
        for (const dv of dailyValues) {
          const dist = Math.abs(dv.timestamp - anchor.timestamp)
          if (dist < closestDist) {
            closestDist = dist
            closestDv = dv
          }
        }
        if (!closestDv || closestDv.value <= 0 || closestDist > DAY_SECONDS) continue

        // Validate anchor: compute median of 5 nearest daily values
        const nearestValues = dailyValues
          .map((dv) => ({ dist: Math.abs(dv.timestamp - anchor.timestamp), value: dv.value }))
          .filter((d) => d.value > 0)
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5)
          .map((d) => d.value)
          .sort((a, b) => a - b)
        const nearestMedian = nearestValues.length >= 3
          ? nearestValues[Math.floor(nearestValues.length / 2)]
          : closestDv.value

        // Skip anchor if it differs from local reconstruction median by >5x (likely a bad snapshot)
        const anchorReconRatio = anchor.value / nearestMedian
        if (anchorReconRatio > 5.0 || anchorReconRatio < 0.2) {
          console.warn(`[reconstructor] Skipping outlier anchor: value=${anchor.value}, median=${nearestMedian}, ratio=${anchorReconRatio.toFixed(2)}`)
          continue
        }

        const scale = anchor.value / closestDv.value
        if (scale > 0.2 && scale < 5.0) {
          anchorScales.push({ timestamp: anchor.timestamp, scale })
        }
      }

      anchorScales.sort((a, b) => a.timestamp - b.timestamp)

      if (anchorScales.length > 0) {
        for (let i = 0; i < dailyValues.length; i++) {
          const dv = dailyValues[i]
          if (dv.value <= 0) continue

          // Find bracketing anchors
          let prevAnchor: (typeof anchorScales)[0] | null = null
          let nextAnchor: (typeof anchorScales)[0] | null = null
          for (const as of anchorScales) {
            if (as.timestamp <= dv.timestamp) prevAnchor = as
            if (as.timestamp > dv.timestamp && !nextAnchor) nextAnchor = as
          }

          let scale = 1
          if (prevAnchor && nextAnchor) {
            // Linearly interpolate scale between two anchors
            const gap = nextAnchor.timestamp - prevAnchor.timestamp
            const ratio = gap > 0 ? (dv.timestamp - prevAnchor.timestamp) / gap : 0
            scale = prevAnchor.scale + (nextAnchor.scale - prevAnchor.scale) * ratio
          } else if (prevAnchor) {
            // Use nearest anchor's scale directly (no decay)
            scale = prevAnchor.scale
          } else if (nextAnchor) {
            // Limit backward extrapolation to 30 days — a single future anchor
            // shouldn't rescale arbitrarily old history
            const lookbackLimit = 30 * DAY_SECONDS
            if (nextAnchor.timestamp - dv.timestamp <= lookbackLimit) {
              scale = nextAnchor.scale
            }
          }

          if (scale !== 1 && Number.isFinite(scale) && scale > 0) {
            dailyValues[i] = { ...dv, value: dv.value * scale }
          }
        }
      }
    }
  }

  // Step 4: Filter out invalid daily values before storing
  const { valid: validDailyValues } = filterValidPoints(dailyValues)

  if (validDailyValues.length === 0) {
    return { snapshotsCreated: 0, priceResolution }
  }

  // Step 5: Atomically replace reconstructed snapshots (delete + insert in one transaction)
  const snapshots = validDailyValues.map((dv) => ({
    userId,
    totalValue: dv.value,
    walletCount: walletAddresses.length,
    source: "reconstructed",
    metadata: JSON.stringify({
      walletFingerprint: walletAddresses.join("|"),
      reconstructionVersion: "tx_cache_daily_v4_defi_supplement",
    }),
    createdAt: new Date(dv.timestamp * 1000),
  }))

  const BATCH = 500
  await db.$transaction(async (tx) => {
    await tx.portfolioSnapshot.deleteMany({
      where: { userId, source: "reconstructed" },
    })
    for (let i = 0; i < snapshots.length; i += BATCH) {
      await tx.portfolioSnapshot.createMany({
        data: snapshots.slice(i, i + BATCH),
        skipDuplicates: true,
      })
    }
  })

  console.log(`[reconstructor] Created ${snapshots.length} reconstructed snapshots`)
  return { snapshotsCreated: snapshots.length, priceResolution }
}
