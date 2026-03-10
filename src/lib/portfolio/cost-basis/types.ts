/**
 * Cost-basis engine types and Form 8949 helpers.
 */

import type { TxClassification } from "@/lib/portfolio/transaction-classifier"

export type CostBasisMethod = "FIFO" | "LIFO" | "HIFO"
export type Form8949Box = "G" | "H" | "I" | "J" | "K" | "L"

export interface CostBasisSummary {
  lotsCreated: number
  gainsRealized: number
  capitalFlows: number
  totalRealizedGain: number
  totalCostBasis: number
  totalProceeds: number
  transactionsProcessed: number
  pricesResolved: number
  pricesFailed: number
  costBasisMethod: CostBasisMethod
}

export type GroupAction = "skip" | "gas" | "yield" | "swap" | "internal_transfer" | "inflow" | "outflow" | "defi_conversion" | "gift_received" | "gift_sent" | "lost"

export interface TxRow {
  id: string
  txHash: string
  chain: string
  from: string
  to: string | null
  direction: string
  category: string
  asset: string | null
  symbol: string | null
  value: number | null
  usdValue: number | null
  walletAddress: string
  blockTimestamp: number
  txClassification: string | null
  manualClassification: string | null
}

export function determineForm8949Box(
  isLongTerm: boolean,
  walletType: "self_custody" | "broker_with_basis" | "broker_no_basis" = "self_custody",
): Form8949Box {
  switch (walletType) {
    case "broker_with_basis":
      return isLongTerm ? "J" : "G"
    case "broker_no_basis":
      return isLongTerm ? "K" : "H"
    case "self_custody":
    default:
      return isLongTerm ? "L" : "I"
  }
}
