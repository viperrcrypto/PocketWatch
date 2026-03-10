/**
 * Flow reconstruction — barrel re-export + pickFlow orchestrator.
 * Heavy logic lives in flow-helpers.ts and flow-ledger.ts.
 */

import { getTxChain, walletChainKey } from "./constants"
import { isReceiptTokenPosition, fallbackAggregateFlow } from "./flow-helpers"
import { reconstructFlowFromLedger } from "./flow-ledger"
import type { LifecyclePositionInput, TxContext, FlowTotals } from "./types"

// ─── Flow picker ───

export function pickFlow(
  position: LifecyclePositionInput,
  txContext: TxContext,
): FlowTotals {
  const txChain = getTxChain(position.chain)
  if (!txChain) {
    return {
      depositedUsd: 0,
      withdrawnUsd: 0,
      claimedUsd: 0,
      depositedNative: 0,
      withdrawnNative: 0,
      nativeSymbol: null,
      earliestInTs: 0,
      latestInTs: 0,
      latestOutTs: 0,
      confidence: "estimated",
      confidenceReason: "Unsupported chain mapping for flow reconstruction",
      reconstructedTxs: 0,
      rolloverTxs: 0,
      rolloverInUsd: 0,
      rolloverOutUsd: 0,
      rolloverSuccessorSymbol: null,
    }
  }

  const entries = txContext.byWalletChain.get(walletChainKey(position.wallet, txChain)) ?? []
  if (entries.length === 0) {
    return fallbackAggregateFlow(position, txContext, "No transaction-ledger rows")
  }

  const reconstructed = reconstructFlowFromLedger(
    position,
    txChain,
    entries,
    txContext.ownWallets,
  )

  if (reconstructed.reconstructedTxs > 0) {
    const isReceipt = isReceiptTokenPosition(position)
    const unresolvedReceipt = isReceipt
      && reconstructed.depositedUsd === 0
      && reconstructed.withdrawnUsd === 0
      && reconstructed.claimedUsd === 0
    if (!unresolvedReceipt) return reconstructed
  }

  return fallbackAggregateFlow(position, txContext, "Tx-ledger incomplete")
}

// ─── Re-exports ───

export { isReceiptTokenPosition, addToAgg, fallbackAggregateFlow } from "./flow-helpers"
export { reconstructFlowFromLedger } from "./flow-ledger"
