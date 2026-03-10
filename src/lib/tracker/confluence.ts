// Confluence detection: alerts when 3+ tracked wallets buy the same token within a time window.
// Used by the scanner cron after inserting new transactions.

import { db } from "@/lib/db"

export interface ConfluenceHit {
  tokenAddress: string
  tokenSymbol: string
  chain: string
  wallets: Array<{
    walletId: string
    walletAddress: string
    walletLabel: string | null
    txHash: string
    valueUsd: number | null
    blockTimestamp: Date
  }>
  priceUsd: number | null
  marketCap: number | null
}

/**
 * Detect confluence events for a given user.
 * Looks at BUY transactions in the last `windowMinutes` across all tracked wallets
 * and groups by token. Returns tokens where `minWallets` or more distinct wallets bought.
 *
 * Only considers transactions created since `since` (to avoid re-alerting on old data).
 */
export async function detectConfluence(
  userId: string,
  {
    windowMinutes = 1,
    minWallets = 3,
    since,
  }: {
    windowMinutes?: number
    minWallets?: number
    since?: Date
  } = {}
): Promise<ConfluenceHit[]> {
  // Get all user's wallet IDs
  const userWallets = await db.trackerWallet.findMany({
    where: { userId, isActive: true },
    select: { id: true, address: true, label: true },
  })

  if (userWallets.length < minWallets) return []

  const walletIds = userWallets.map((w) => w.id)
  const walletMap = new Map(userWallets.map((w) => [w.id, w]))

  // Time window: look at transactions from the last N minutes
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000)

  // Query recent BUY transactions across all user's wallets
  const recentBuys = await db.walletTransaction.findMany({
    where: {
      trackerWalletId: { in: walletIds },
      type: { in: ["BUY", "SWAP"] },
      blockTimestamp: { gte: windowStart },
      tokenAddress: { not: null },
      // Only look at transactions inserted since last check (avoid re-alerting)
      ...(since ? { createdAt: { gte: since } } : {}),
    },
    orderBy: { blockTimestamp: "desc" },
  })

  if (recentBuys.length === 0) return []

  // Group by (tokenAddress, chain) and collect distinct wallets
  const groups = new Map<
    string,
    {
      tokenAddress: string
      tokenSymbol: string
      chain: string
      priceUsd: number | null
      marketCap: number | null
      entries: Map<
        string,
        {
          walletId: string
          txHash: string
          valueUsd: number | null
          blockTimestamp: Date
        }
      >
    }
  >()

  for (const tx of recentBuys) {
    if (!tx.tokenAddress) continue

    const key = `${tx.tokenAddress.toLowerCase()}_${tx.chain}`

    if (!groups.has(key)) {
      groups.set(key, {
        tokenAddress: tx.tokenAddress,
        tokenSymbol: tx.tokenSymbol || "Unknown",
        chain: tx.chain,
        priceUsd: tx.priceUsd,
        marketCap: tx.marketCap,
        entries: new Map(),
      })
    }

    const group = groups.get(key)!

    // Only keep one entry per wallet (the most recent)
    if (!group.entries.has(tx.trackerWalletId)) {
      group.entries.set(tx.trackerWalletId, {
        walletId: tx.trackerWalletId,
        txHash: tx.txHash,
        valueUsd: tx.valueUsd,
        blockTimestamp: tx.blockTimestamp,
      })
    }

    // Update price/mcap if we have newer data
    if (tx.priceUsd != null) group.priceUsd = tx.priceUsd
    if (tx.marketCap != null) group.marketCap = tx.marketCap
  }

  // Filter to groups with minWallets+ distinct wallets
  const hits: ConfluenceHit[] = []

  for (const group of groups.values()) {
    if (group.entries.size >= minWallets) {
      const wallets = Array.from(group.entries.values()).map((entry) => {
        const w = walletMap.get(entry.walletId)
        return {
          walletId: entry.walletId,
          walletAddress: w?.address || "",
          walletLabel: w?.label || null,
          txHash: entry.txHash,
          valueUsd: entry.valueUsd,
          blockTimestamp: entry.blockTimestamp,
        }
      })

      hits.push({
        tokenAddress: group.tokenAddress,
        tokenSymbol: group.tokenSymbol,
        chain: group.chain,
        wallets,
        priceUsd: group.priceUsd,
        marketCap: group.marketCap,
      })
    }
  }

  return hits
}
