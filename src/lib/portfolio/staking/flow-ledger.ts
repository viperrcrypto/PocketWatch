import {
  RECEIPT_SYMBOL_PATTERNS,
  DUST_USD_THRESHOLD,
  round2,
} from "./constants"
import {
  isInternalSelfTransfer,
  isReceiptTokenPosition,
  buildPositionSymbolAliases,
  buildKnownRewardDistributorSet,
  isRewardCategoryHint,
  positionLegMatch,
  isReceiptLikeSymbol,
  emptyFlow,
} from "./flow-helpers"
import type {
  LifecyclePositionInput,
  TxLeg,
  FlowTotals,
  FlowLedgerEntryInput,
} from "./types"

// ─── Full ledger reconstruction ───

export function reconstructFlowFromLedger(
  position: LifecyclePositionInput,
  txChain: string,
  entries: FlowLedgerEntryInput[],
  ownWalletsInput: Iterable<string> = [],
): FlowTotals {
  const ownWallets = new Set(Array.from(ownWalletsInput).map((wallet) => wallet.toLowerCase()))
  const isReceipt = isReceiptTokenPosition(position)
  const positionAssets = new Set<string>()
  if (position.contractAddress) positionAssets.add(position.contractAddress.toLowerCase())
  const positionSymbols = buildPositionSymbolAliases(position)
  const rewardDistributorSet = buildKnownRewardDistributorSet(position, txChain)

  let depositedUsd = 0
  let withdrawnUsd = 0
  let claimedUsd = 0
  let depositedNative = 0
  let withdrawnNative = 0
  let nativeSymbol: string | null = null
  let earliestInTs = Infinity
  let latestInTs = 0
  let latestOutTs = 0
  let reconstructedTxs = 0
  let ambiguousRewardUsd = 0
  let rolloverTxs = 0
  let rolloverInUsd = 0
  let rolloverOutUsd = 0
  let rolloverSuccessorSymbol: string | null = null

  for (const entry of entries) {
    if (!entry.txHash) continue

    const txResult = processTransactionEntry(
      entry, positionAssets, positionSymbols, ownWallets,
      rewardDistributorSet, isReceipt, latestInTs,
    )

    if (!txResult.matched) continue
    reconstructedTxs += 1
    ambiguousRewardUsd += txResult.ambiguousRewardUsd
    claimedUsd += txResult.claimInUsd
    latestInTs = txResult.latestInTs

    if (txResult.isRolloverOut || txResult.isRolloverIn) {
      rolloverTxs += 1
      if (txResult.isRolloverOut) {
        rolloverOutUsd += txResult.positionOutUsd
        if (!rolloverSuccessorSymbol) {
          rolloverSuccessorSymbol = findRolloverSuccessor(entry, positionSymbols)
        }
      }
      if (txResult.isRolloverIn) {
        rolloverInUsd += txResult.positionInUsd
      }
    }

    if (isReceipt) {
      const receiptResult = applyReceiptFlow(txResult, depositedUsd, depositedNative, nativeSymbol, earliestInTs, latestOutTs, withdrawnUsd, withdrawnNative, positionSymbols)
      depositedUsd = receiptResult.depositedUsd
      depositedNative = receiptResult.depositedNative
      withdrawnUsd = receiptResult.withdrawnUsd
      withdrawnNative = receiptResult.withdrawnNative
      nativeSymbol = receiptResult.nativeSymbol
      earliestInTs = receiptResult.earliestInTs
      latestOutTs = receiptResult.latestOutTs
      continue
    }

    // Non-receipt: out = deposit (sending to protocol), in = withdrawal (receiving back)
    depositedUsd += txResult.positionOutUsd
    depositedNative += txResult.positionOutQty
    withdrawnUsd += txResult.positionInUsd
    withdrawnNative += txResult.positionInQty
    if (txResult.positionOutUsd > 0 && txResult.txTimestamp > 0) earliestInTs = Math.min(earliestInTs, txResult.txTimestamp)
    if (txResult.positionInUsd > 0 && txResult.txTimestamp > 0) latestOutTs = Math.max(latestOutTs, txResult.txTimestamp)
    if (!nativeSymbol && (positionSymbols.size > 0)) {
      nativeSymbol = positionSymbols.values().next().value ?? null
    }
  }

  if (earliestInTs === Infinity) earliestInTs = 0

  // Cross-tx rollover detection
  const crossTxRollover = detectCrossTxRollover(
    isReceipt, depositedUsd, withdrawnUsd, rolloverTxs, reconstructedTxs,
    entries, positionAssets, positionSymbols, position.symbol,
  )
  if (crossTxRollover) {
    rolloverTxs = crossTxRollover.rolloverTxs
    rolloverOutUsd = crossTxRollover.rolloverOutUsd
  }

  if (reconstructedTxs === 0) {
    return emptyFlow("estimated", "No matched transaction legs for position")
  }

  return buildFlowResult({
    depositedUsd, withdrawnUsd, claimedUsd, depositedNative, withdrawnNative,
    nativeSymbol, earliestInTs, latestInTs, latestOutTs, reconstructedTxs,
    rolloverTxs, rolloverInUsd, rolloverOutUsd, rolloverSuccessorSymbol,
    ambiguousRewardUsd,
  })
}

// ─── Internal helpers ───

interface TxEntryResult {
  matched: boolean
  positionInUsd: number
  positionOutUsd: number
  positionInQty: number
  positionOutQty: number
  counterpartInUsd: number
  counterpartOutUsd: number
  counterpartInQty: number
  counterpartOutQty: number
  counterpartInReceiptUsd: number
  counterpartInNonReceiptUsd: number
  counterpartOutReceiptUsd: number
  counterpartOutNonReceiptUsd: number
  counterpartInSymbol: string | null
  counterpartOutSymbol: string | null
  claimInUsd: number
  ambiguousRewardUsd: number
  txTimestamp: number
  latestInTs: number
  isRolloverOut: boolean
  isRolloverIn: boolean
}

function processTransactionEntry(
  entry: FlowLedgerEntryInput,
  positionAssets: Set<string>,
  positionSymbols: Set<string>,
  ownWallets: Set<string>,
  rewardDistributorSet: Set<string>,
  isReceipt: boolean,
  prevLatestInTs: number,
): TxEntryResult {
  let positionInUsd = 0, positionOutUsd = 0, positionInQty = 0, positionOutQty = 0
  let counterpartInUsd = 0, counterpartOutUsd = 0, counterpartInQty = 0, counterpartOutQty = 0
  let counterpartInReceiptUsd = 0, counterpartInNonReceiptUsd = 0
  let counterpartOutReceiptUsd = 0, counterpartOutNonReceiptUsd = 0
  let counterpartInSymbol: string | null = null, counterpartOutSymbol: string | null = null
  let claimInUsd = 0, ambiguousRewardUsd = 0, txTimestamp = 0
  let matched = false
  let latestInTs = prevLatestInTs

  for (const rawLeg of entry.legs) {
    const leg: TxLeg = {
      asset: rawLeg.asset?.toLowerCase() ?? null,
      symbol: rawLeg.symbol?.toUpperCase() ?? null,
      direction: rawLeg.direction === "out" ? "out" : "in",
      usd: Number(rawLeg.usd ?? 0),
      quantity: Number(rawLeg.quantity ?? 0),
      blockTimestamp: Number(rawLeg.blockTimestamp ?? 0),
      from: rawLeg.from?.toLowerCase() ?? null,
      to: rawLeg.to?.toLowerCase() ?? null,
      category: rawLeg.category ?? null,
    }

    if (!Number.isFinite(leg.usd) || leg.usd <= 0) continue
    if (isInternalSelfTransfer(leg, ownWallets)) continue

    const isPositionLeg = positionLegMatch(leg, positionAssets, positionSymbols)
    if (isPositionLeg) {
      matched = true
      if (leg.blockTimestamp > 0) txTimestamp = leg.blockTimestamp
      if (leg.direction === "in") {
        positionInUsd += leg.usd
        positionInQty += leg.quantity
        if (leg.blockTimestamp > latestInTs) latestInTs = leg.blockTimestamp
      } else {
        positionOutUsd += leg.usd
        positionOutQty += leg.quantity
      }
      continue
    }

    if (leg.direction === "in") {
      counterpartInUsd += leg.usd
      counterpartInQty += leg.quantity
      if (!counterpartInSymbol && leg.symbol) counterpartInSymbol = leg.symbol
      if (isReceiptLikeSymbol(leg.symbol)) counterpartInReceiptUsd += leg.usd
      else counterpartInNonReceiptUsd += leg.usd
      if (leg.from && rewardDistributorSet.has(leg.from)) claimInUsd += leg.usd
      else if (isRewardCategoryHint(leg.category)) ambiguousRewardUsd += leg.usd
    } else {
      counterpartOutUsd += leg.usd
      counterpartOutQty += leg.quantity
      if (!counterpartOutSymbol && leg.symbol) counterpartOutSymbol = leg.symbol
      if (isReceiptLikeSymbol(leg.symbol)) counterpartOutReceiptUsd += leg.usd
      else counterpartOutNonReceiptUsd += leg.usd
    }
  }

  const isRolloverOut = isReceipt
    && positionOutUsd > 0 && counterpartInReceiptUsd > 0
    && counterpartInNonReceiptUsd <= DUST_USD_THRESHOLD && counterpartOutUsd <= DUST_USD_THRESHOLD
  const isRolloverIn = isReceipt
    && positionInUsd > 0 && counterpartOutReceiptUsd > 0
    && counterpartOutNonReceiptUsd <= DUST_USD_THRESHOLD && counterpartInUsd <= DUST_USD_THRESHOLD

  return {
    matched, positionInUsd, positionOutUsd, positionInQty, positionOutQty,
    counterpartInUsd, counterpartOutUsd, counterpartInQty, counterpartOutQty,
    counterpartInReceiptUsd, counterpartInNonReceiptUsd,
    counterpartOutReceiptUsd, counterpartOutNonReceiptUsd,
    counterpartInSymbol, counterpartOutSymbol,
    claimInUsd, ambiguousRewardUsd, txTimestamp, latestInTs,
    isRolloverOut, isRolloverIn,
  }
}

function findRolloverSuccessor(entry: FlowLedgerEntryInput, positionSymbols: Set<string>): string | null {
  for (const rawLeg of entry.legs) {
    const sym = rawLeg.symbol?.toUpperCase() ?? null
    if (sym && isReceiptLikeSymbol(sym) && !positionSymbols.has(sym)) {
      return sym
    }
  }
  return null
}

function applyReceiptFlow(
  tx: TxEntryResult,
  depositedUsd: number,
  depositedNative: number,
  nativeSymbol: string | null,
  earliestInTs: number,
  latestOutTs: number,
  withdrawnUsd: number,
  withdrawnNative: number,
  positionSymbols: Set<string>,
): {
  depositedUsd: number; depositedNative: number; withdrawnUsd: number
  withdrawnNative: number; nativeSymbol: string | null; earliestInTs: number; latestOutTs: number
} {
  // A rollover-in is only "recycled capital" (should skip deposit) when the
  // counterpart-out token is NOT in the position's symbol aliases.
  // e.g. sUSDai receiving back from Pendle maturity: counterpart-out = PT-sUSDai
  //      → PT-sUSDai NOT in sUSDai's aliases → recycled → skip deposit.
  // e.g. PT-sUSDai receiving via deposit: counterpart-out = sUSDai
  //      → sUSDai IS in PT-sUSDai's aliases (via underlying) → real deposit → keep.
  const isRecycledRollover = tx.isRolloverIn
    && tx.counterpartOutSymbol != null
    && !positionSymbols.has(tx.counterpartOutSymbol.toUpperCase())

  if (tx.positionInUsd > 0 && tx.counterpartOutUsd > 0 && !isRecycledRollover) {
    const counterpartIsYieldBearing = tx.counterpartOutReceiptUsd > tx.counterpartOutNonReceiptUsd
    depositedUsd += counterpartIsYieldBearing
      ? Math.max(tx.counterpartOutUsd, tx.positionInUsd)
      : tx.counterpartOutUsd
    depositedNative += tx.counterpartOutQty
    if (!nativeSymbol && tx.counterpartOutSymbol) nativeSymbol = tx.counterpartOutSymbol
    if (tx.txTimestamp > 0) earliestInTs = Math.min(earliestInTs, tx.txTimestamp)
  }
  if (tx.positionOutUsd > 0) {
    if (tx.txTimestamp > 0) latestOutTs = Math.max(latestOutTs, tx.txTimestamp)
  }
  if (tx.positionOutUsd > 0 && !tx.isRolloverOut) {
    if (tx.counterpartInUsd > DUST_USD_THRESHOLD) {
      withdrawnUsd += Math.max(0, tx.counterpartInUsd - tx.claimInUsd)
      withdrawnNative += tx.counterpartInQty
      if (!nativeSymbol && tx.counterpartInSymbol) nativeSymbol = tx.counterpartInSymbol
    } else {
      withdrawnUsd += tx.positionOutUsd
      const estimatedNativeQty = (depositedNative > 0 && depositedUsd > 0)
        ? tx.positionOutUsd * (depositedNative / depositedUsd)
        : 0
      withdrawnNative += estimatedNativeQty
    }
  }

  return { depositedUsd, depositedNative, withdrawnUsd, withdrawnNative, nativeSymbol, earliestInTs, latestOutTs }
}

function detectCrossTxRollover(
  isReceipt: boolean,
  depositedUsd: number,
  withdrawnUsd: number,
  rolloverTxs: number,
  reconstructedTxs: number,
  entries: FlowLedgerEntryInput[],
  positionAssets: Set<string>,
  positionSymbols: Set<string>,
  symbol: string,
): { rolloverTxs: number; rolloverOutUsd: number } | null {
  if (
    !isReceipt
    || depositedUsd <= DUST_USD_THRESHOLD
    || withdrawnUsd > DUST_USD_THRESHOLD
    || rolloverTxs !== 0
    || reconstructedTxs === 0
  ) return null

  let totalPositionOutUsd = 0
  for (const entry of entries) {
    if (!entry.txHash) continue
    for (const rawLeg of entry.legs) {
      const leg: TxLeg = {
        asset: rawLeg.asset?.toLowerCase() ?? null,
        symbol: rawLeg.symbol?.toUpperCase() ?? null,
        direction: rawLeg.direction === "out" ? "out" : "in",
        usd: Number(rawLeg.usd ?? 0),
        quantity: Number(rawLeg.quantity ?? 0),
        blockTimestamp: Number(rawLeg.blockTimestamp ?? 0),
        from: rawLeg.from?.toLowerCase() ?? null,
        to: rawLeg.to?.toLowerCase() ?? null,
        category: rawLeg.category ?? null,
      }
      if (leg.direction === "out" && leg.usd > 0 && positionLegMatch(leg, positionAssets, positionSymbols)) {
        totalPositionOutUsd += leg.usd
      }
    }
  }

  if (totalPositionOutUsd > DUST_USD_THRESHOLD) {
    console.log(
      `[flow-reconstruction] cross-tx rollover detected for ${symbol}: `
      + `$${round2(totalPositionOutUsd)} exit value from OUT legs`,
    )
    return { rolloverTxs: 1, rolloverOutUsd: totalPositionOutUsd }
  }

  return null
}

function buildFlowResult(params: {
  depositedUsd: number; withdrawnUsd: number; claimedUsd: number
  depositedNative: number; withdrawnNative: number; nativeSymbol: string | null
  earliestInTs: number; latestInTs: number; latestOutTs: number
  reconstructedTxs: number; rolloverTxs: number
  rolloverInUsd: number; rolloverOutUsd: number
  rolloverSuccessorSymbol: string | null; ambiguousRewardUsd: number
}): FlowTotals {
  const { rolloverTxs, ambiguousRewardUsd, claimedUsd } = params

  let confidence: "exact" | "modeled" = "exact"
  let confidenceReason = "Tx-hash flow reconstruction"

  if (rolloverTxs > 0) {
    confidence = "modeled"
    confidenceReason = "Tx-hash flow reconstruction with rollover transfers"
  } else if (ambiguousRewardUsd > 0) {
    confidence = "modeled"
    confidenceReason = "Tx-hash flow reconstruction with unmatched reward inflows"
  } else if (claimedUsd > 0) {
    confidenceReason = "Tx-hash flow reconstruction + strict distributor claim matching"
  }

  return {
    depositedUsd: round2(params.depositedUsd),
    withdrawnUsd: round2(params.withdrawnUsd),
    claimedUsd: round2(params.claimedUsd),
    depositedNative: params.depositedNative,
    withdrawnNative: params.withdrawnNative,
    nativeSymbol: params.nativeSymbol,
    earliestInTs: params.earliestInTs,
    latestInTs: params.latestInTs,
    latestOutTs: params.latestOutTs,
    confidence,
    confidenceReason,
    reconstructedTxs: params.reconstructedTxs,
    rolloverTxs: params.rolloverTxs,
    rolloverInUsd: round2(params.rolloverInUsd),
    rolloverOutUsd: round2(params.rolloverOutUsd),
    rolloverSuccessorSymbol: params.rolloverSuccessorSymbol,
  }
}
