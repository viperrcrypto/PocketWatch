import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import type { TrackerTransaction, TrackerChain } from "@/lib/tracker/types"

/** GET /api/tracker/feed — paginated transaction feed across all wallets */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T7001", "Authentication required", 401)

  const { searchParams } = request.nextUrl
  const chain = searchParams.get("chain")
  const type = searchParams.get("type")
  const walletId = searchParams.get("walletId")
  const cursor = searchParams.get("cursor")
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100)

  try {
    // Get user's wallet IDs
    const wallets = await db.trackedWallet.findMany({
      where: { userId: user.id, isActive: true },
      select: { id: true, address: true, label: true, emoji: true, primaryChain: true },
    })

    if (wallets.length === 0) {
      return NextResponse.json({ transactions: [], nextCursor: undefined })
    }

    const walletMap = new Map(wallets.map((w) => [w.id, w]))
    const walletIds = walletId ? [walletId] : wallets.map((w) => w.id)

    // Build query filter
    const where: Record<string, unknown> = {
      walletId: { in: walletIds },
    }
    if (chain) where.chain = chain
    if (type) where.type = type

    const txs = await db.trackerTx.findMany({
      where,
      orderBy: { blockTimestamp: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })

    const hasMore = txs.length > limit
    const items = hasMore ? txs.slice(0, limit) : txs

    const transactions: TrackerTransaction[] = items.map((tx) => {
      const wallet = walletMap.get(tx.walletId)
      return {
        id: tx.id,
        txHash: tx.txHash,
        type: tx.type as TrackerTransaction["type"],
        chain: tx.chain as TrackerChain,
        blockTimestamp: tx.blockTimestamp.toISOString(),
        walletId: tx.walletId,
        walletAddress: wallet?.address,
        walletLabel: wallet?.label ?? undefined,
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
      }
    })

    return NextResponse.json({
      transactions,
      nextCursor: hasMore ? items[items.length - 1].id : undefined,
    })
  } catch (error) {
    return apiError("T7002", "Failed to load feed", 500, error)
  }
}
