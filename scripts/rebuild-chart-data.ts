/**
 * Rebuild chart data: clear wipe marker, clean bad snapshots,
 * trigger exchange reconstruction.
 * Run: npx tsx scripts/rebuild-chart-data.ts
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const users = await db.user.findMany({ select: { id: true, username: true } })

  for (const user of users) {
    console.log(`\n=== Rebuilding chart data for ${user.username} ===\n`)

    // 1. Clear the chartWipedAt flag so Zerion cache can rebuild
    const setting = await db.portfolioSetting.findUnique({
      where: { userId: user.id },
      select: { settings: true },
    })
    if (setting?.settings && typeof setting.settings === "object") {
      const s = { ...(setting.settings as Record<string, unknown>) }
      if (s.chartWipedAt) {
        delete s.chartWipedAt
        // Also clear stale fingerprint to force fresh Zerion fetch
        delete s.chartWalletFingerprint
        delete s.chartCacheUpdatedAt
        await db.portfolioSetting.update({
          where: { userId: user.id },
          data: { settings: s as any },
        })
        console.log("[1] Cleared chartWipedAt + stale fingerprint — Zerion cache will rebuild on next load")
      } else {
        console.log("[1] No chartWipedAt flag — chart fetch is unblocked")
      }
    }

    // 2. Delete zero-value exchange balance snapshots
    const deletedZeroExchange = await db.exchangeBalanceSnapshot.deleteMany({
      where: { userId: user.id, totalValue: { lte: 0 } },
    })
    console.log(`[2] Deleted ${deletedZeroExchange.count} zero-value exchange balance snapshots`)

    // 3. Delete exchange snapshots to force fresh reconstruction with historical prices
    const deletedAllExchange = await db.exchangeBalanceSnapshot.deleteMany({
      where: { userId: user.id },
    })
    console.log(`[3] Deleted ${deletedAllExchange.count} exchange balance snapshots (will reconstruct with historical prices)`)

    // 4. Check for outlier reconstructed snapshots and remove them
    const reconstructed = await db.portfolioSnapshot.findMany({
      where: { userId: user.id, source: "reconstructed" },
      orderBy: { createdAt: "asc" },
      select: { id: true, totalValue: true, createdAt: true },
    })

    if (reconstructed.length > 0) {
      const values = reconstructed.map((s) => s.totalValue).sort((a, b) => a - b)
      const median = values[Math.floor(values.length / 2)]
      const outlierIds = reconstructed
        .filter((s) => s.totalValue > median * 5 || (s.totalValue < median * 0.1 && s.totalValue > 0))
        .map((s) => s.id)

      if (outlierIds.length > 0) {
        await db.portfolioSnapshot.deleteMany({
          where: { id: { in: outlierIds } },
        })
        console.log(`[4] Deleted ${outlierIds.length} outlier reconstructed snapshots (median=$${median.toFixed(0)})`)
      } else {
        console.log(`[4] No outlier reconstructed snapshots found (median=$${median.toFixed(0)}, range $${values[0].toFixed(0)}-$${values[values.length - 1].toFixed(0)})`)
      }
    }

    // 5. Check for outlier live_refresh snapshots
    const liveSnapshots = await db.portfolioSnapshot.findMany({
      where: { userId: user.id, source: "live_refresh" },
      orderBy: { createdAt: "asc" },
      select: { id: true, totalValue: true, createdAt: true },
    })
    if (liveSnapshots.length > 2) {
      const liveValues = liveSnapshots.map((s) => s.totalValue).sort((a, b) => a - b)
      const liveMedian = liveValues[Math.floor(liveValues.length / 2)]
      const liveOutliers = liveSnapshots
        .filter((s) => s.totalValue > liveMedian * 5 || (s.totalValue < liveMedian * 0.1 && s.totalValue > 0))
        .map((s) => s.id)
      if (liveOutliers.length > 0) {
        await db.portfolioSnapshot.deleteMany({ where: { id: { in: liveOutliers } } })
        console.log(`[5] Deleted ${liveOutliers.length} outlier live_refresh snapshots`)
      } else {
        console.log(`[5] No outlier live_refresh snapshots`)
      }
    } else {
      console.log(`[5] Only ${liveSnapshots.length} live_refresh snapshot(s) — keeping all`)
    }

    // 6. Final state report
    const [chartCount, snapCount, exchCount] = await Promise.all([
      db.chartCache.count({ where: { userId: user.id } }),
      db.portfolioSnapshot.count({ where: { userId: user.id } }),
      db.exchangeBalanceSnapshot.count({ where: { userId: user.id } }),
    ])
    console.log(`\n=== Post-cleanup state ===`)
    console.log(`ChartCache: ${chartCount} rows (will rebuild on next page load via Zerion)`)
    console.log(`PortfolioSnapshots: ${snapCount} rows`)
    console.log(`ExchangeBalanceSnapshots: ${exchCount} rows (will reconstruct on next TOTAL chart load)`)
    console.log(`\nNext steps: Load the dashboard in your browser. The chart will:`)
    console.log(`  1. Fetch fresh data from Zerion API → populate ChartCache`)
    console.log(`  2. Merge with reconstructed snapshots (285 days of history)`)
    console.log(`  3. On TOTAL toggle → reconstruct exchange balance history with historical prices`)
    console.log(`  4. All new data passes through outlier detection + validation layer`)
  }

  await db.$disconnect()
}

main().catch((e) => {
  console.error("Rebuild error:", e)
  process.exit(1)
})
