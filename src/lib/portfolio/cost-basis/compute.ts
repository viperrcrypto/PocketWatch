/**
 * Cost-basis compute pipeline: idempotent rebuild from transaction history.
 * Groups by txHash, classifies semantically, and processes each group.
 */

import { db } from "@/lib/db"
import { resolveUnpricedTransactions, normalizeSymbolForPricing } from "@/lib/portfolio/price-resolver"
import { reclassifyAllTransactions, type TxClassification } from "@/lib/portfolio/transaction-classifier"
import { normalizeWalletAddress } from "@/lib/portfolio/utils"
import type { CostBasisMethod, CostBasisSummary, GroupAction, TxRow } from "./types"
import { getUserCostBasisMethod } from "./lot-tracker"
import {
  type GroupCounters, emptyCounters,
  processGas, processYield, processSwap, processDefiConversion,
  processInternalTransfer, processInflow, processOutflow,
  processGiftReceived, processGiftSent, processLost,
} from "./group-processors"

// ─── Determine group-level action from semantic classifications ───

function determineGroupAction(
  rows: TxRow[],
  _ownAddresses: Set<string>,
): GroupAction {
  const classifications = rows.map((r) => r.txClassification).filter(Boolean) as TxClassification[]

  if (classifications.includes("spam")) return "skip"
  if (classifications.every((c) => c === "gas")) return "gas"
  if (classifications.includes("yield")) return "yield"
  if (classifications.includes("swap")) return "swap"

  if (classifications.includes("internal_transfer")) {
    const outRows = rows.filter((r) => r.direction === "out")
    const inRows = rows.filter((r) => r.direction === "in")
    if (outRows.length > 0 && inRows.length > 0) {
      const outNorm = new Set(outRows.map((r) => normalizeSymbolForPricing(r.symbol)).filter(Boolean))
      const inNorm = new Set(inRows.map((r) => normalizeSymbolForPricing(r.symbol)).filter(Boolean))
      const overlap = [...outNorm].some((s) => inNorm.has(s))
      if (overlap) return "defi_conversion"
      if (outNorm.size > 0 && inNorm.size > 0) {
        const noOverlap = ![...outNorm].some((s) => inNorm.has(s))
        if (noOverlap) return "swap"
      }
    }
    return "internal_transfer"
  }

  if (classifications.includes("inflow")) return "inflow"
  if (classifications.includes("outflow")) return "outflow"

  if (classifications.includes("income" as TxClassification)) return "yield"
  if (classifications.includes("gift_received" as TxClassification)) return "gift_received"
  if (classifications.includes("gift_sent" as TxClassification)) return "gift_sent"
  if (classifications.includes("lost" as TxClassification)) return "lost"
  if (classifications.includes("bridge" as TxClassification)) return "internal_transfer"
  if (classifications.includes("dust" as TxClassification)) return "skip"

  const hasIn = rows.some((r) => r.direction === "in")
  const hasOut = rows.some((r) => r.direction === "out")
  if (hasIn && hasOut) return "swap"
  return hasIn ? "inflow" : "outflow"
}

// ─── Group Processing Dispatcher ───

async function processGroup(
  action: GroupAction,
  userId: string,
  txHash: string,
  group: TxRow[],
  timestamp: Date,
  method: CostBasisMethod,
  ownAddresses: Set<string>,
  processedMigrations: Set<string>,
): Promise<GroupCounters> {
  const c = emptyCounters()

  switch (action) {
    case "skip":
      break
    case "gas":
      await processGas(userId, txHash, group, timestamp, method, c)
      break
    case "yield":
      await processYield(userId, txHash, group, timestamp, c)
      break
    case "swap":
      await processSwap(userId, txHash, group, timestamp, method, c)
      break
    case "defi_conversion":
      await processDefiConversion(userId, txHash, group, timestamp, method, c)
      break
    case "internal_transfer":
      await processInternalTransfer(userId, txHash, group, timestamp, method, ownAddresses, processedMigrations, c)
      break
    case "inflow":
      await processInflow(userId, txHash, group, timestamp, ownAddresses, c)
      break
    case "outflow":
      await processOutflow(userId, txHash, group, timestamp, method, ownAddresses, processedMigrations, c)
      break
    case "gift_received":
      await processGiftReceived(userId, txHash, group, timestamp, c)
      break
    case "gift_sent":
      await processGiftSent(userId, txHash, group, timestamp, method, c)
      break
    case "lost":
      await processLost(userId, txHash, group, timestamp, method, c)
      break
  }

  return c
}

// ─── Compute Pipeline (Idempotent) ───

export async function computeCostBasis(userId: string): Promise<CostBasisSummary> {
  const method = await getUserCostBasisMethod(userId)

  const classifyResult = await reclassifyAllTransactions(userId)
  console.log(`[cost-basis] Reclassified ${classifyResult.classified} transactions`)

  await db.$transaction(async (tx) => {
    await tx.costBasisLot.deleteMany({ where: { userId } })
    await tx.realizedGain.deleteMany({ where: { userId } })
    await tx.capitalFlow.deleteMany({ where: { userId } })
  })

  const wallets = await db.trackedWallet.findMany({
    where: { userId },
    select: { address: true },
  })

  const ownAddresses = new Set(wallets.map((w) => normalizeWalletAddress(w.address)))

  if (ownAddresses.size === 0) {
    return {
      lotsCreated: 0, gainsRealized: 0, capitalFlows: 0,
      totalRealizedGain: 0, totalCostBasis: 0, totalProceeds: 0,
      transactionsProcessed: 0, pricesResolved: 0, pricesFailed: 0,
      costBasisMethod: method,
    }
  }

  const priceResult = await resolveUnpricedTransactions(userId)
  console.log(`[cost-basis] Price resolution: ${priceResult.resolved} resolved, ${priceResult.failed} failed, ${priceResult.total} total`)

  const transactions = await db.transactionCache.findMany({
    where: { userId, value: { not: null } },
    orderBy: { blockTimestamp: "asc" },
  }) as TxRow[]

  for (const tx of transactions) {
    if (tx.manualClassification) {
      tx.txClassification = tx.manualClassification
    }
  }

  const txGroups = new Map<string, TxRow[]>()
  for (const tx of transactions) {
    const group = txGroups.get(tx.txHash) ?? []
    group.push(tx)
    txGroups.set(tx.txHash, group)
  }

  const sortedGroups = [...txGroups.entries()].sort((a, b) => {
    const aMin = Math.min(...a[1].map((r) => r.blockTimestamp))
    const bMin = Math.min(...b[1].map((r) => r.blockTimestamp))
    return aMin - bMin
  })

  let lotsCreated = 0
  let gainsRealized = 0
  let capitalFlows = 0
  let totalRealizedGain = 0
  let totalCostBasis = 0
  let totalProceeds = 0
  const processedMigrations = new Set<string>()

  for (const [txHash, group] of sortedGroups) {
    const action = determineGroupAction(group, ownAddresses)
    const timestamp = new Date(Math.min(...group.map((r) => r.blockTimestamp)) * 1000)

    const counters = await processGroup(
      action, userId, txHash, group, timestamp, method, ownAddresses, processedMigrations
    )
    lotsCreated += counters.lotsCreated
    gainsRealized += counters.gainsRealized
    capitalFlows += counters.capitalFlows
    totalRealizedGain += counters.totalRealizedGain
    totalCostBasis += counters.totalCostBasis
    totalProceeds += counters.totalProceeds
  }

  return {
    lotsCreated,
    gainsRealized,
    capitalFlows,
    totalRealizedGain,
    totalCostBasis,
    totalProceeds,
    transactionsProcessed: transactions.length,
    pricesResolved: priceResult.resolved,
    pricesFailed: priceResult.failed,
    costBasisMethod: method,
  }
}
