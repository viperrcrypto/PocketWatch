import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import type { TrackerTransaction, TrackerChain } from "@/lib/tracker/types"

/** GET /api/tracker/wallets/:id/transactions — paginated tx history for a wallet */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return apiError("T4001", "Authentication required", 401)

  const { id } = await params
  const { searchParams } = request.nextUrl
  const cursor = searchParams.get("cursor")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)

  try {
    const wallet = await db.trackedWallet.findFirst({
      where: { id, userId: user.id },
      select: { id: true, address: true, label: true, emoji: true, primaryChain: true },
    })

    if (!wallet) {
      return apiError("T4002", "Wallet not found", 404)
    }

    const txs = await db.trackerTx.findMany({
      where: { walletId: id },
      orderBy: { blockTimestamp: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = txs.length > limit
    const items = hasMore ? txs.slice(0, limit) : txs

    const transactions: TrackerTransaction[] = items.map((tx) => ({
      id: tx.id,
      txHash: tx.txHash,
      type: tx.type as TrackerTransaction["type"],
      chain: tx.chain as TrackerChain,
      blockTimestamp: tx.blockTimestamp.toISOString(),
      walletId: wallet.id,
      walletAddress: wallet.address,
      walletLabel: wallet.label ?? undefined,
      tokenAddress: tx.tokenAddress ?? undefined,
      tokenSymbol: tx.tokenSymbol ?? undefined,
      tokenName: tx.tokenName ?? undefined,
      amountFormatted: tx.amountFormatted ?? undefined,
      valueUsd: tx.valueUsd ?? undefined,
      priceUsd: tx.priceUsd ?? undefined,
      marketCap: tx.marketCap ?? undefined,
      tokenInAddress: tx.tokenInAddress ?? undefined,
      tokenInSymbol: tx.tokenInSymbol ?? undefined,
      tokenInAmount: tx.tokenInAmount ?? undefined,
      tokenOutAddress: tx.tokenOutAddress ?? undefined,
      tokenOutSymbol: tx.tokenOutSymbol ?? undefined,
      tokenOutAmount: tx.tokenOutAmount ?? undefined,
      fromAddress: tx.fromAddress ?? undefined,
      toAddress: tx.toAddress ?? undefined,
      dexName: tx.dexName ?? undefined,
    }))

    return NextResponse.json({
      transactions,
      nextCursor: hasMore ? items[items.length - 1].id : undefined,
    })
  } catch (error) {
    return apiError("T4003", "Failed to load transactions", 500, error)
  }
}
