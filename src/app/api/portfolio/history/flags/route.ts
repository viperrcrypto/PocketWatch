import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** POST /api/portfolio/history/flags — flag/unflag or whitelist/un-whitelist a received transaction */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9400", "Authentication required", 401)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("E9401", "Invalid JSON body", 400)
  }

  const { txHash, chain, walletAddress, flagged, whitelisted } = body as Record<string, unknown>

  if (!txHash || typeof txHash !== "string") return apiError("E9402", "Missing required field: txHash", 400)
  if (!chain || typeof chain !== "string") return apiError("E9403", "Missing required field: chain", 400)
  if (!walletAddress || typeof walletAddress !== "string") return apiError("E9404", "Missing required field: walletAddress", 400)

  const hasFlagged = typeof flagged === "boolean"
  const hasWhitelisted = typeof whitelisted === "boolean"
  if (!hasFlagged && !hasWhitelisted) {
    return apiError("E9405", "Must provide flagged (boolean) or whitelisted (boolean)", 400)
  }

  try {
    // TransactionCache stores EVM addresses lowercased; try both casings.
    // Also try txHash lowercased for EVM chains.
    const txHashVariants = [txHash, txHash.toLowerCase()]
    const walletVariants = [walletAddress, walletAddress.toLowerCase()]

    let row = await db.transactionCache.findFirst({
      where: {
        userId: user.id,
        chain,
        txHash: { in: txHashVariants },
        walletAddress: { in: walletVariants },
        direction: "in",
      },
      select: { id: true },
    })

    // Fallback: try without direction filter (some rows may store direction differently)
    if (!row) {
      row = await db.transactionCache.findFirst({
        where: {
          userId: user.id,
          chain,
          txHash: { in: txHashVariants },
          walletAddress: { in: walletVariants },
        },
        select: { id: true },
      })
    }

    if (!row) {
      return apiError("E9406", `Transaction not found (chain=${chain}, txHash=${txHash.slice(0, 12)}…)`, 404)
    }

    const data: Record<string, unknown> = {}

    if (hasFlagged) {
      data.isFlagged = flagged
      data.flaggedAt = flagged ? new Date() : null
      // Flagging and whitelisting are mutually exclusive
      if (flagged) {
        data.isWhitelisted = false
        data.whitelistedAt = null
      }
    }

    if (hasWhitelisted) {
      data.isWhitelisted = whitelisted
      data.whitelistedAt = whitelisted ? new Date() : null
      // Whitelisting and flagging are mutually exclusive
      if (whitelisted) {
        data.isFlagged = false
        data.flaggedAt = null
      }
    }

    const updated = await db.transactionCache.update({
      where: { id: row.id },
      data,
      select: { isFlagged: true, isWhitelisted: true },
    })

    return NextResponse.json({
      success: true,
      isFlagged: updated.isFlagged,
      isWhitelisted: updated.isWhitelisted,
    })
  } catch (error) {
    return apiError("E9407", "Failed to update transaction flag", 500, error)
  }
}
