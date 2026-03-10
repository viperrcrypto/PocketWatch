import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { scanEvmWallet, scanSolanaWallet } from "@/lib/tracker/scanner"
import { getServiceKey } from "@/lib/portfolio/service-keys"
import { refineTransactionType } from "@/lib/tracker/classifier"
import type { TrackerChain } from "@/lib/tracker/types"

/** POST /api/tracker/wallets/:id/scan — trigger an on-demand scan */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return apiError("T3001", "Authentication required", 401)

  const { id } = await params

  try {
    const wallet = await db.trackedWallet.findFirst({
      where: { id, userId: user.id },
    })

    if (!wallet) {
      return apiError("T3002", "Wallet not found", 404)
    }

    const chain = wallet.primaryChain as TrackerChain

    // Get the appropriate API key for scanning
    let scanResult
    if (chain === "SOLANA") {
      const heliusKey = await getServiceKey(user.id, "helius")
      if (!heliusKey) {
        return apiError("T3003", "Helius API key required for Solana scanning. Add one in Portfolio Settings.", 400)
      }
      scanResult = await scanSolanaWallet(
        wallet.address,
        heliusKey,
        wallet.lastScanSig ?? undefined
      )
    } else {
      // EVM chain — try explorer key first, fall back to free tier
      const explorerService = `${chain.toLowerCase()}scan`
      const apiKey = await getServiceKey(user.id, explorerService) ?? ""
      scanResult = await scanEvmWallet(
        wallet.address,
        chain,
        apiKey,
        wallet.lastScanBlock ? BigInt(wallet.lastScanBlock) : undefined
      )
    }

    // Refine classifications and store transactions
    const txData = scanResult.transactions.map((tx) => {
      const refined = refineTransactionType(tx, wallet.address)
      return {
        walletId: wallet.id,
        txHash: tx.txHash,
        chain: tx.chain,
        type: refined,
        blockTimestamp: tx.blockTimestamp,
        blockNumber: tx.blockNumber?.toString() ?? null,
        tokenAddress: tx.tokenAddress ?? null,
        tokenSymbol: tx.tokenSymbol ?? null,
        tokenName: tx.tokenName ?? null,
        amountFormatted: tx.amountFormatted ?? null,
        valueUsd: tx.valueUsd ?? null,
        priceUsd: tx.priceUsd ?? null,
        marketCap: tx.marketCap ?? null,
        tokenInAddress: tx.tokenInAddress ?? null,
        tokenInSymbol: tx.tokenInSymbol ?? null,
        tokenInAmount: tx.tokenInAmount ?? null,
        tokenOutAddress: tx.tokenOutAddress ?? null,
        tokenOutSymbol: tx.tokenOutSymbol ?? null,
        tokenOutAmount: tx.tokenOutAmount ?? null,
        fromAddress: tx.fromAddress ?? null,
        toAddress: tx.toAddress ?? null,
        dexName: tx.dexName ?? null,
      }
    })

    // Bulk upsert — skip duplicates
    let inserted = 0
    if (txData.length > 0) {
      // Use createMany with skipDuplicates for efficiency
      const result = await db.trackerTx.createMany({
        data: txData,
        skipDuplicates: true,
      })
      inserted = result.count
    }

    // Update wallet scan cursor
    const updateData: Record<string, unknown> = {
      lastScannedAt: new Date(),
    }
    if (scanResult.lastBlock !== undefined) {
      updateData.lastScanBlock = scanResult.lastBlock.toString()
    }
    if (scanResult.lastSignature) {
      updateData.lastScanSig = scanResult.lastSignature
    }

    await db.trackedWallet.update({
      where: { id: wallet.id },
      data: updateData,
    })

    return NextResponse.json({
      success: true,
      found: txData.length,
      inserted,
      lastScannedAt: new Date().toISOString(),
    })
  } catch (error) {
    return apiError("T3004", "Scan failed", 500, error)
  }
}
