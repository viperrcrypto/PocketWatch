import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { getAllHealthyServiceKeys } from "@/lib/portfolio/service-keys"
import { fetchWalletTransactions } from "@/lib/portfolio/zerion-client"

/**
 * GET /api/portfolio/history/sync/test-zerion?walletAddress=0x...
 *
 * Makes a single Zerion API call to verify the key works and
 * the wallet has indexed transaction data. Returns raw results
 * without affecting sync state.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  const walletAddress = request.nextUrl.searchParams.get("walletAddress")?.trim()
  if (!walletAddress || walletAddress.length > 200) {
    return apiError("E9420", "walletAddress query param is required", 400)
  }

  // Verify wallet belongs to this user
  const wallet = await db.trackedWallet.findFirst({
    where: { userId: user.id, address: walletAddress },
    select: { address: true },
  })
  if (!wallet) return apiError("E9421", "Wallet not found", 404)

  const keys = await getAllHealthyServiceKeys(user.id, "zerion")
  if (keys.length === 0) {
    return NextResponse.json({
      success: false,
      error: "no_zerion_keys",
      message: "No verified Zerion API keys found",
    })
  }

  try {
    const result = await fetchWalletTransactions(keys[0].key, walletAddress.toLowerCase(), {
      pageSize: 5,
    })

    const txs = result.data ?? []
    return NextResponse.json({
      success: true,
      keyUsed: keys[0].label ?? "(unlabeled)",
      txCount: txs.length,
      hasMore: !!result.links?.next,
      firstTx: txs[0]
        ? {
            hash: txs[0].attributes.hash,
            minedAt: txs[0].attributes.mined_at,
            status: txs[0].attributes.status,
            operationType: txs[0].attributes.operation_type,
          }
        : null,
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: "zerion_api_error",
      message: "Zerion API request failed",
    })
  }
}
