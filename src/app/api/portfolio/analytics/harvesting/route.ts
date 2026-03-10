import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

interface HarvestableAsset {
  asset: string
  symbol: string
  walletAddress: string
  remainingQty: number
  costBasisUsd: number
  currentValueUsd: number
  unrealizedGainUsd: number
  isLongTerm: boolean
  avgCostPerUnit: number
  currentPriceUsd: number
  oldestLotDate: string
}

/** GET /api/portfolio/analytics/harvesting — Tax-loss harvesting opportunities */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9250", "Authentication required", 401)

  try {
    // Fetch open lots grouped by asset + wallet
    const openLots = await db.costBasisLot.findMany({
      where: { userId: user.id, remainingQty: { gt: 0 } },
      orderBy: { acquiredAt: "asc" },
    })

    if (openLots.length === 0) {
      return NextResponse.json({
        assets: [],
        totalHarvestableLoss: 0,
        totalHarvestableShortTerm: 0,
        totalHarvestableLongTerm: 0,
        note: "No open lots found. Compute cost basis first.",
      })
    }

    // Fetch latest balance snapshots to get current prices
    const wallets = await db.trackedWallet.findMany({
      where: { userId: user.id },
      select: { id: true, address: true },
    })

    const walletIds = wallets.map((w) => w.id)
    const latestSnapshots = await db.balanceSnapshot.findMany({
      where: { walletId: { in: walletIds } },
      orderBy: { fetchedAt: "desc" },
      distinct: ["walletId"],
    })

    // Build price map from positions: { "walletAddress:symbol" -> priceUsd }
    const priceMap = new Map<string, number>()
    for (const snap of latestSnapshots) {
      const wallet = wallets.find((w) => w.id === snap.walletId)
      if (!wallet) continue
      try {
        const positions = JSON.parse(snap.positions)
        if (Array.isArray(positions)) {
          for (const pos of positions) {
            if (pos.symbol && pos.price != null) {
              priceMap.set(`${wallet.address.toLowerCase()}:${pos.symbol.toLowerCase()}`, pos.price)
            }
          }
        }
      } catch {
        // Ignore malformed position data
      }
    }

    // Aggregate lots by asset+wallet
    const groupKey = (lot: typeof openLots[0]) =>
      `${lot.walletAddress.toLowerCase()}:${lot.asset}`

    const groups = new Map<string, typeof openLots>()
    for (const lot of openLots) {
      const key = groupKey(lot)
      const existing = groups.get(key) ?? []
      groups.set(key, [...existing, lot])
    }

    const now = Date.now()
    const harvestable: HarvestableAsset[] = []

    for (const [, lots] of groups) {
      const first = lots[0]
      const totalQty = lots.reduce((s, l) => s + l.remainingQty, 0)
      const totalCost = lots.reduce((s, l) => {
        const fraction = l.remainingQty / l.quantity
        return s + fraction * l.costBasisUsd
      }, 0)

      // Get current price
      const lookupKey = `${first.walletAddress.toLowerCase()}:${first.symbol.toLowerCase()}`
      const currentPrice = priceMap.get(lookupKey) ?? 0
      const currentValue = totalQty * currentPrice
      const unrealized = currentValue - totalCost

      // Determine if majority of lots are long-term
      const oldestDate = lots[0].acquiredAt // lots are sorted by acquiredAt asc
      const holdingMs = now - oldestDate.getTime()
      const isLongTerm = holdingMs >= 365 * 86400_000

      harvestable.push({
        asset: first.asset,
        symbol: first.symbol,
        walletAddress: first.walletAddress,
        remainingQty: totalQty,
        costBasisUsd: totalCost,
        currentValueUsd: currentValue,
        unrealizedGainUsd: unrealized,
        isLongTerm,
        avgCostPerUnit: totalQty > 0 ? totalCost / totalQty : 0,
        currentPriceUsd: currentPrice,
        oldestLotDate: oldestDate.toISOString(),
      })
    }

    // Sort by largest loss (most negative) first
    harvestable.sort((a, b) => a.unrealizedGainUsd - b.unrealizedGainUsd)

    const losses = harvestable.filter((a) => a.unrealizedGainUsd < 0)
    const totalHarvestableLoss = losses.reduce((s, a) => s + a.unrealizedGainUsd, 0)
    const totalHarvestableShortTerm = losses
      .filter((a) => !a.isLongTerm)
      .reduce((s, a) => s + a.unrealizedGainUsd, 0)
    const totalHarvestableLongTerm = losses
      .filter((a) => a.isLongTerm)
      .reduce((s, a) => s + a.unrealizedGainUsd, 0)

    return NextResponse.json({
      assets: harvestable,
      totalHarvestableLoss,
      totalHarvestableShortTerm,
      totalHarvestableLongTerm,
      note: "Wash sale rule does not currently apply to cryptocurrency. You may immediately repurchase after harvesting losses.",
    })
  } catch (error) {
    return apiError("E9251", "Failed to compute harvesting opportunities", 500, error)
  }
}
