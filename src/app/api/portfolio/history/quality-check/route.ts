import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { fetchQualityData, runQualityAnalysis } from "@/lib/portfolio/quality-check-helpers"
import {
  type RepairRequest,
  repairFutureTimestamps,
  repairAncientTimestamps,
  repairEmptyTxHashes,
  repairZeroValueTxs,
  repairNullValueTxs,
  repairDuplicateTxs,
  repairResyncChain,
  repairDeleteChainData,
  repairResyncAllFailed,
  repairClearThrottle,
  repairNukeWallet,
  repairResyncWallet,
} from "@/lib/portfolio/quality-check-repairs"

/**
 * GET /api/portfolio/history/quality-check
 *
 * Comprehensive transaction data quality analysis:
 * - Structural integrity (timestamps, values, hashes)
 * - Completeness (all categories present, sync vs DB row count match)
 * - Consistency (block ordering, direction balance, category coverage)
 * - Sync health (stuck, failed, throttled states)
 * - Data freshness (how recent is the latest tx per chain)
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  try {
    const data = await fetchQualityData(user.id)
    const result = runQualityAnalysis(data)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return apiError("E9099", "Quality check failed", 500, error)
  }
}

/**
 * POST /api/portfolio/history/quality-check
 * Surgical repair for specific data quality issues.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  let body: RepairRequest
  try {
    body = await req.json()
  } catch {
    return apiError("E9100", "Invalid JSON body", 400)
  }

  const { action, chain, wallet } = body
  if (!action) {
    return apiError("E9100", "Missing action field", 400)
  }

  try {
    const handlers: Record<string, () => Promise<unknown>> = {
      future_timestamps: () => repairFutureTimestamps(user.id),
      ancient_timestamps: () => repairAncientTimestamps(user.id),
      empty_tx_hashes: () => repairEmptyTxHashes(user.id),
      zero_value_txs: () => Promise.resolve(repairZeroValueTxs()),
      null_value_txs: () => repairNullValueTxs(user.id),
      duplicate_txs: () => repairDuplicateTxs(user.id),
      resync_chain: () => repairResyncChain(user.id, chain, wallet),
      delete_chain_data: () => repairDeleteChainData(user.id, chain),
      resync_all_failed: () => repairResyncAllFailed(user.id),
      clear_throttle: () => repairClearThrottle(user.id),
      nuke_wallet: () => repairNukeWallet(user.id, wallet),
      resync_wallet: () => repairResyncWallet(user.id, wallet),
    }

    const handler = handlers[action]
    if (!handler) {
      return apiError("E9100", `Unknown repair action: ${action}`, 400)
    }

    const result = await handler()

    // Handle validation errors returned from repair functions
    if (result && typeof result === "object" && "code" in result && "status" in result) {
      const err = result as { error: string; code: string; status: number }
      return apiError(err.code, err.error, err.status)
    }

    return NextResponse.json(result)
  } catch (error) {
    return apiError("E9101", `Repair action "${action}" failed`, 500, error)
  }
}
