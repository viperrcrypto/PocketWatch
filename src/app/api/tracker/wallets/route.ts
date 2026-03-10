import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import type { TrackerChain } from "@/lib/tracker/types"
import { isEvmAddress, isSolanaAddress } from "@/lib/tracker/chains"

/** GET /api/tracker/wallets — list tracked wallets with summary stats */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("T1001", "Authentication required", 401)

  try {
    const wallets = await db.trackedWallet.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { transactions: true } },
        transactions: {
          orderBy: { blockTimestamp: "desc" },
          take: 1,
          select: { blockTimestamp: true },
        },
      },
    })

    const result = wallets.map((w) => ({
      id: w.id,
      address: w.address,
      label: w.label,
      emoji: w.emoji,
      chain: w.primaryChain as TrackerChain,
      isActive: w.isActive,
      lastScannedAt: w.lastScannedAt?.toISOString(),
      createdAt: w.createdAt.toISOString(),
      txCount: w._count.transactions,
      lastTxAt: w.transactions[0]?.blockTimestamp?.toISOString() ?? undefined,
    }))

    return NextResponse.json({ wallets: result })
  } catch (error) {
    return apiError("T1002", "Failed to load wallets", 500, error)
  }
}

/** POST /api/tracker/wallets — add a wallet to track */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T1003", "Authentication required", 401)

  try {
    const body = await request.json()
    const { address, label, emoji, chain } = body as {
      address: string
      label?: string
      emoji?: string
      chain: TrackerChain
    }

    if (!address || typeof address !== "string") {
      return apiError("T1004", "address is required", 400)
    }

    const trimmed = address.trim()

    // Validate address format
    if (!isEvmAddress(trimmed) && !isSolanaAddress(trimmed)) {
      return apiError("T1005", "Invalid address format", 400)
    }

    const primaryChain = chain || (isSolanaAddress(trimmed) ? "SOLANA" : "ETHEREUM")

    const wallet = await db.trackedWallet.upsert({
      where: { userId_address: { userId: user.id, address: trimmed } },
      create: {
        userId: user.id,
        address: trimmed,
        label: label || null,
        emoji: emoji || null,
        primaryChain,
        chains: [primaryChain.toLowerCase()],
      },
      update: {
        label: label || undefined,
        emoji: emoji || undefined,
        primaryChain,
        isActive: true,
      },
    })

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        address: wallet.address,
        label: wallet.label,
        emoji: wallet.emoji,
        chain: wallet.primaryChain as TrackerChain,
        isActive: wallet.isActive,
        createdAt: wallet.createdAt.toISOString(),
      },
    })
  } catch (error) {
    return apiError("T1006", "Failed to add wallet", 500, error)
  }
}
