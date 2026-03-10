/**
 * Lot tracking: sorting, disposal processing, and lot migration for internal transfers.
 */

import { db } from "@/lib/db"
import type { CostBasisMethod, Form8949Box } from "./types"
import { determineForm8949Box } from "./types"

// ─── Lot Sorting by Method ───

export function sortLotsByMethod<T extends { acquiredAt: Date; costBasisUsd: number; quantity: number }>(
  lots: T[],
  method: CostBasisMethod,
): T[] {
  switch (method) {
    case "LIFO":
      return [...lots].sort((a, b) => b.acquiredAt.getTime() - a.acquiredAt.getTime())
    case "HIFO":
      return [...lots].sort((a, b) => {
        const costPerUnitA = a.quantity > 0 ? a.costBasisUsd / a.quantity : 0
        const costPerUnitB = b.quantity > 0 ? b.costBasisUsd / b.quantity : 0
        return costPerUnitB - costPerUnitA
      })
    case "FIFO":
    default:
      return [...lots].sort((a, b) => a.acquiredAt.getTime() - b.acquiredAt.getTime())
  }
}

// ─── Lot Matching (Wallet-by-Wallet, Multi-Method) ───

export async function processDisposal(
  userId: string,
  walletAddress: string,
  asset: string,
  symbol: string,
  quantity: number,
  proceedsUsd: number,
  txHash: string,
  disposedAt: Date,
  method: CostBasisMethod,
): Promise<{ gainUsd: number; costBasisUsd: number }> {
  const rawLots = await db.costBasisLot.findMany({
    where: { userId, asset, walletAddress, remainingQty: { gt: 0 } },
    orderBy: { acquiredAt: "asc" },
  })

  const lots = sortLotsByMethod(rawLots, method)

  let remainingToSell = quantity
  let totalCostBasis = 0
  let weightedHoldingDays = 0
  let earliestAcquiredAt: Date | null = null
  let lotsConsumed = 0

  const lotUpdates: Array<{ id: string; remainingQty: number }> = []

  for (const lot of lots) {
    if (remainingToSell <= 0) break

    const consumed = Math.min(lot.remainingQty, remainingToSell)
    const costPerUnit = lot.quantity > 0 ? lot.costBasisUsd / lot.quantity : 0
    totalCostBasis += consumed * costPerUnit
    remainingToSell -= consumed
    lotsConsumed++

    if (earliestAcquiredAt === null || lot.acquiredAt < earliestAcquiredAt) {
      earliestAcquiredAt = lot.acquiredAt
    }

    const holdingMs = disposedAt.getTime() - lot.acquiredAt.getTime()
    const holdingDays = Math.max(0, Math.floor(holdingMs / (1000 * 60 * 60 * 24)))
    weightedHoldingDays += holdingDays * (consumed / quantity)

    lotUpdates.push({ id: lot.id, remainingQty: lot.remainingQty - consumed })
  }

  const gainUsd = proceedsUsd - totalCostBasis
  const holdingPeriod = Math.round(weightedHoldingDays)
  const isLongTerm = holdingPeriod >= 365
  const acquiredAtVarious = lotsConsumed > 1
  const form8949Box = determineForm8949Box(isLongTerm)

  await db.$transaction(async (tx) => {
    for (const update of lotUpdates) {
      await tx.costBasisLot.update({
        where: { id: update.id },
        data: { remainingQty: update.remainingQty },
      })
    }

    await tx.realizedGain.create({
      data: {
        userId,
        walletAddress,
        asset,
        symbol,
        disposedAt,
        quantity,
        proceedsUsd,
        costBasisUsd: totalCostBasis,
        gainUsd,
        txHash,
        holdingPeriod,
        acquiredAt: earliestAcquiredAt,
        acquiredAtVarious,
        costBasisMethod: method,
        form8949Box,
      },
    })
  })

  return { gainUsd, costBasisUsd: totalCostBasis }
}

// ─── Lot Migration for Internal Transfers ───

/**
 * Migrates cost-basis lots from one wallet to another during internal transfers.
 * Preserves original acquisition dates and proportional cost basis.
 */
export async function migrateLots(
  userId: string,
  fromWallet: string,
  toWallet: string,
  asset: string,
  symbol: string,
  quantity: number,
  transferTxHash: string,
  method: CostBasisMethod,
): Promise<number> {
  const rawLots = await db.costBasisLot.findMany({
    where: { userId, asset, walletAddress: fromWallet, remainingQty: { gt: 0 } },
    orderBy: { acquiredAt: "asc" },
  })

  const lots = sortLotsByMethod(rawLots, method)
  let remaining = quantity
  let lotsMigrated = 0

  const updates: Array<{ id: string; remainingQty: number }> = []
  const creates: Array<{
    userId: string; walletAddress: string; asset: string; symbol: string
    acquiredAt: Date; quantity: number; remainingQty: number
    costBasisUsd: number; txHash: string; source: string
  }> = []

  for (const lot of lots) {
    if (remaining <= 0) break

    const consumed = Math.min(lot.remainingQty, remaining)
    const costPerUnit = lot.quantity > 0 ? lot.costBasisUsd / lot.quantity : 0
    const migratedCostBasis = consumed * costPerUnit

    updates.push({ id: lot.id, remainingQty: lot.remainingQty - consumed })

    creates.push({
      userId,
      walletAddress: toWallet,
      asset,
      symbol,
      acquiredAt: lot.acquiredAt,
      quantity: consumed,
      remainingQty: consumed,
      costBasisUsd: migratedCostBasis,
      txHash: transferTxHash,
      source: "internal_transfer",
    })

    remaining -= consumed
    lotsMigrated++
  }

  // Conservative: zero-basis lot for any quantity exceeding known lots
  if (remaining > 0) {
    creates.push({
      userId,
      walletAddress: toWallet,
      asset,
      symbol,
      acquiredAt: new Date(0),
      quantity: remaining,
      remainingQty: remaining,
      costBasisUsd: 0,
      txHash: transferTxHash,
      source: "internal_transfer",
    })
    lotsMigrated++
  }

  await db.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.costBasisLot.update({
        where: { id: update.id },
        data: { remainingQty: update.remainingQty },
      })
    }
    for (const data of creates) {
      await tx.costBasisLot.create({ data })
    }
  })

  return lotsMigrated
}

// ─── Read User's Cost Basis Method ───

export async function getUserCostBasisMethod(userId: string): Promise<CostBasisMethod> {
  const setting = await db.portfolioSetting.findUnique({ where: { userId } })
  const settings = (setting?.settings as Record<string, unknown>) ?? {}
  const method = settings.costBasisMethod as string | undefined
  if (method === "LIFO" || method === "HIFO") return method
  return "FIFO"
}
