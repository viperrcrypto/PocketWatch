/**
 * Cost-basis group processors: individual action handlers for each transaction type.
 */

import { db } from "@/lib/db"
import { normalizeWalletAddress } from "@/lib/portfolio/utils"
import type { CostBasisMethod, TxRow } from "./types"
import { sortLotsByMethod, processDisposal, migrateLots } from "./lot-tracker"

// ─── Counters Interface ───

export interface GroupCounters {
  lotsCreated: number
  gainsRealized: number
  capitalFlows: number
  totalRealizedGain: number
  totalCostBasis: number
  totalProceeds: number
}

export function emptyCounters(): GroupCounters {
  return { lotsCreated: 0, gainsRealized: 0, capitalFlows: 0, totalRealizedGain: 0, totalCostBasis: 0, totalProceeds: 0 }
}

// ─── Gas ───

export async function processGas(userId: string, txHash: string, group: TxRow[], timestamp: Date, method: CostBasisMethod, c: GroupCounters) {
  for (const tx of group) {
    if (tx.direction !== "out") continue
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    const usdValue = tx.usdValue ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const result = await processDisposal(userId, walletAddr, asset, symbol, value, usdValue, txHash, timestamp, method)
    c.gainsRealized++
    c.totalRealizedGain += result.gainUsd
    c.totalCostBasis += result.costBasisUsd
    c.totalProceeds += usdValue

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "gas", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Yield ───

export async function processYield(userId: string, txHash: string, group: TxRow[], timestamp: Date, c: GroupCounters) {
  for (const tx of group) {
    if (tx.direction !== "in") continue
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    const usdValue = tx.usdValue ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    await db.costBasisLot.create({
      data: { userId, walletAddress: walletAddr, asset, symbol, acquiredAt: timestamp, quantity: value, remainingQty: value, costBasisUsd: usdValue, txHash, source: "yield" },
    })
    c.lotsCreated++

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "yield", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? tx.walletAddress, txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Swap ───

export async function processSwap(userId: string, txHash: string, group: TxRow[], timestamp: Date, method: CostBasisMethod, c: GroupCounters) {
  const outRows = group.filter((r) => r.direction === "out")
  const inRows = group.filter((r) => r.direction === "in")

  for (const tx of outRows) {
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    const usdValue = tx.usdValue ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const result = await processDisposal(userId, walletAddr, asset, symbol, value, usdValue, txHash, timestamp, method)
    c.gainsRealized++
    c.totalRealizedGain += result.gainUsd
    c.totalCostBasis += result.costBasisUsd
    c.totalProceeds += usdValue

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "swap_out", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
    })
    c.capitalFlows++
  }

  for (const tx of inRows) {
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    const usdValue = tx.usdValue ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    await db.costBasisLot.create({
      data: { userId, walletAddress: walletAddr, asset, symbol, acquiredAt: timestamp, quantity: value, remainingQty: value, costBasisUsd: usdValue, txHash, source: "swap" },
    })
    c.lotsCreated++

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "swap_in", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? tx.walletAddress, txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── DeFi Conversion ───

export async function processDefiConversion(userId: string, txHash: string, group: TxRow[], timestamp: Date, method: CostBasisMethod, c: GroupCounters) {
  const outRows = group.filter((r) => r.direction === "out")
  const inRows = group.filter((r) => r.direction === "in")

  let totalOutCostBasis = 0
  for (const tx of outRows) {
    const asset = tx.asset ?? "native"
    const value = tx.value ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const rawLots = await db.costBasisLot.findMany({
      where: { userId, asset, walletAddress: walletAddr, remainingQty: { gt: 0 } },
      orderBy: { acquiredAt: "asc" },
    })
    const lots = sortLotsByMethod(rawLots, method)
    let remaining = value

    const lotUpdates: Array<{ id: string; remainingQty: number }> = []
    for (const lot of lots) {
      if (remaining <= 0) break
      const consumed = Math.min(lot.remainingQty, remaining)
      const costPerUnit = lot.quantity > 0 ? lot.costBasisUsd / lot.quantity : 0
      totalOutCostBasis += consumed * costPerUnit
      remaining -= consumed
      lotUpdates.push({ id: lot.id, remainingQty: lot.remainingQty - consumed })
    }

    if (lotUpdates.length > 0) {
      await db.$transaction(
        lotUpdates.map((u) =>
          db.costBasisLot.update({ where: { id: u.id }, data: { remainingQty: u.remainingQty } })
        )
      )
    }

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "defi_deposit", asset, symbol: tx.symbol ?? "ETH", amount: value, usdValue: tx.usdValue ?? 0, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
    })
    c.capitalFlows++
  }

  const totalInUsdValue = inRows.reduce((sum, r) => sum + (r.usdValue ?? 0), 0)
  for (const tx of inRows) {
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const proportionalBasis = totalInUsdValue > 0
      ? totalOutCostBasis * ((tx.usdValue ?? 0) / totalInUsdValue)
      : 0

    await db.costBasisLot.create({
      data: { userId, walletAddress: walletAddr, asset, symbol, acquiredAt: timestamp, quantity: value, remainingQty: value, costBasisUsd: proportionalBasis, txHash, source: "defi_conversion" },
    })
    c.lotsCreated++

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "defi_receipt", asset, symbol, amount: value, usdValue: tx.usdValue ?? 0, fromAddress: tx.from, toAddress: tx.to ?? tx.walletAddress, txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Internal Transfer ───

export async function processInternalTransfer(userId: string, txHash: string, group: TxRow[], timestamp: Date, method: CostBasisMethod, ownAddresses: Set<string>, processedMigrations: Set<string>, c: GroupCounters) {
  if (!processedMigrations.has(txHash)) {
    processedMigrations.add(txHash)
    const outRows = group.filter((r) => r.direction === "out")
    for (const tx of outRows) {
      const asset = tx.asset ?? "native"
      const symbol = tx.symbol ?? "ETH"
      const value = tx.value ?? 0
      if (value <= 0) continue

      const fromAddr = normalizeWalletAddress(tx.walletAddress)
      const destAddr = normalizeWalletAddress(tx.to ?? "")

      if (destAddr && ownAddresses.has(destAddr)) {
        const migrated = await migrateLots(userId, fromAddr, destAddr, asset, symbol, value, txHash, method)
        c.lotsCreated += migrated
      }
    }
  }

  for (const tx of group) {
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    const usdValue = tx.usdValue ?? 0

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "internal_transfer", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Inflow ───

export async function processInflow(userId: string, txHash: string, group: TxRow[], timestamp: Date, ownAddresses: Set<string>, c: GroupCounters) {
  for (const tx of group) {
    if (tx.direction !== "in") continue
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    const usdValue = tx.usdValue ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const sourceAddr = normalizeWalletAddress(tx.from)

    if (sourceAddr && ownAddresses.has(sourceAddr)) {
      await db.capitalFlow.create({
        data: { userId, walletAddress: tx.walletAddress, flowType: "internal_transfer", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? tx.walletAddress, txHash, timestamp },
      })
      c.capitalFlows++
      continue
    }

    await db.costBasisLot.create({
      data: { userId, walletAddress: walletAddr, asset, symbol, acquiredAt: timestamp, quantity: value, remainingQty: value, costBasisUsd: usdValue, txHash, source: "external_in" },
    })
    c.lotsCreated++

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "deposit", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? tx.walletAddress, txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Outflow ───

export async function processOutflow(userId: string, txHash: string, group: TxRow[], timestamp: Date, method: CostBasisMethod, ownAddresses: Set<string>, processedMigrations: Set<string>, c: GroupCounters) {
  for (const tx of group) {
    if (tx.direction !== "out") continue
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    const usdValue = tx.usdValue ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const destAddr = normalizeWalletAddress(tx.to ?? "")

    if (destAddr && ownAddresses.has(destAddr)) {
      if (!processedMigrations.has(txHash)) {
        processedMigrations.add(txHash)
        const migrated = await migrateLots(userId, walletAddr, destAddr, asset, symbol, value, txHash, method)
        c.lotsCreated += migrated
      }

      await db.capitalFlow.create({
        data: { userId, walletAddress: tx.walletAddress, flowType: "internal_transfer", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
      })
      c.capitalFlows++
      continue
    }

    const result = await processDisposal(userId, walletAddr, asset, symbol, value, usdValue, txHash, timestamp, method)
    c.gainsRealized++
    c.totalRealizedGain += result.gainUsd
    c.totalCostBasis += result.costBasisUsd
    c.totalProceeds += usdValue

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "withdrawal", asset, symbol, amount: value, usdValue, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Gift Received ───

export async function processGiftReceived(userId: string, txHash: string, group: TxRow[], timestamp: Date, c: GroupCounters) {
  for (const tx of group) {
    if (tx.direction !== "in") continue
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    await db.costBasisLot.create({
      data: { userId, walletAddress: walletAddr, asset, symbol, acquiredAt: timestamp, quantity: value, remainingQty: value, costBasisUsd: 0, txHash, source: "gift_received" },
    })
    c.lotsCreated++

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "gift_received", asset, symbol, amount: value, usdValue: tx.usdValue ?? 0, fromAddress: tx.from, toAddress: tx.to ?? tx.walletAddress, txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Gift Sent ───

export async function processGiftSent(userId: string, txHash: string, group: TxRow[], timestamp: Date, method: CostBasisMethod, c: GroupCounters) {
  for (const tx of group) {
    if (tx.direction !== "out") continue
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const rawLots = await db.costBasisLot.findMany({
      where: { userId, asset, walletAddress: walletAddr, remainingQty: { gt: 0 } },
      orderBy: { acquiredAt: "asc" },
    })
    const lots = sortLotsByMethod(rawLots, method)
    let remaining = value
    const lotUpdates: Array<{ id: string; remainingQty: number }> = []
    for (const lot of lots) {
      if (remaining <= 0) break
      const consumed = Math.min(lot.remainingQty, remaining)
      remaining -= consumed
      lotUpdates.push({ id: lot.id, remainingQty: lot.remainingQty - consumed })
    }
    if (lotUpdates.length > 0) {
      await db.$transaction(
        lotUpdates.map((u) =>
          db.costBasisLot.update({ where: { id: u.id }, data: { remainingQty: u.remainingQty } })
        )
      )
    }

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "gift_sent", asset, symbol, amount: value, usdValue: tx.usdValue ?? 0, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
    })
    c.capitalFlows++
  }
}

// ─── Lost ───

export async function processLost(userId: string, txHash: string, group: TxRow[], timestamp: Date, method: CostBasisMethod, c: GroupCounters) {
  for (const tx of group) {
    if (tx.direction !== "out") continue
    const asset = tx.asset ?? "native"
    const symbol = tx.symbol ?? "ETH"
    const value = tx.value ?? 0
    if (value <= 0) continue

    const walletAddr = normalizeWalletAddress(tx.walletAddress)
    const result = await processDisposal(userId, walletAddr, asset, symbol, value, 0, txHash, timestamp, method)
    c.gainsRealized++
    c.totalRealizedGain += result.gainUsd
    c.totalCostBasis += result.costBasisUsd
    c.totalProceeds += 0

    await db.capitalFlow.create({
      data: { userId, walletAddress: tx.walletAddress, flowType: "lost", asset, symbol, amount: value, usdValue: 0, fromAddress: tx.from, toAddress: tx.to ?? "", txHash, timestamp },
    })
    c.capitalFlows++
  }
}
