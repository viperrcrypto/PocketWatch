/**
 * Diagnostic script to inspect and validate the data pipeline.
 * Run: npx tsx scripts/diagnose-data.ts
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  console.log("=== WealthTracker Data Pipeline Diagnostics ===\n")

  // 1. Users
  const users = await db.user.findMany({ select: { id: true, username: true } })
  console.log(`Users: ${users.map((u) => `${u.username} (${u.id.slice(0, 8)})`).join(", ")}`)

  for (const user of users) {
    console.log(`\n--- User: ${user.username} ---`)

    // 2. Tracked wallets
    const wallets = await db.trackedWallet.findMany({
      where: { userId: user.id },
      select: { address: true, chains: true, label: true },
    })
    console.log(`Tracked wallets: ${wallets.length}`)
    for (const w of wallets) console.log(`  ${w.label || "unlabeled"}: ${w.address.slice(0, 12)}... (${w.chains})`)

    // 3. Chart cache
    const chartCacheCount = await db.chartCache.count({ where: { userId: user.id } })
    const chartStats = chartCacheCount > 0
      ? await db.chartCache.aggregate({
          where: { userId: user.id },
          _min: { value: true, timestamp: true },
          _max: { value: true, timestamp: true },
          _avg: { value: true },
        })
      : null
    console.log(`\nChartCache: ${chartCacheCount} rows`)
    if (chartStats) {
      console.log(`  Min value: $${chartStats._min.value?.toFixed(2)}, Max value: $${chartStats._max.value?.toFixed(2)}, Avg: $${chartStats._avg.value?.toFixed(2)}`)
      console.log(`  Date range: ${new Date(chartStats._min.timestamp! * 1000).toISOString().slice(0, 10)} → ${new Date(chartStats._max.timestamp! * 1000).toISOString().slice(0, 10)}`)
    }

    // 4. Detect spike/dip outliers in chart cache
    if (chartCacheCount > 0) {
      const allChartPoints = await db.chartCache.findMany({
        where: { userId: user.id },
        orderBy: { timestamp: "asc" },
        select: { timestamp: true, value: true },
      })
      const values = allChartPoints.map((p) => p.value).sort((a, b) => a - b)
      const median = values[Math.floor(values.length / 2)]
      const spikes = allChartPoints.filter((p) => p.value > median * 3)
      const dips = allChartPoints.filter((p) => p.value < median * 0.33 && p.value > 0)
      const zeros = allChartPoints.filter((p) => p.value <= 0)
      console.log(`  Median: $${median.toFixed(2)}`)
      console.log(`  Spikes (>3x median): ${spikes.length}${spikes.length > 0 ? ` — max: $${Math.max(...spikes.map((s) => s.value)).toFixed(2)} at ${new Date(spikes.reduce((a, b) => a.value > b.value ? a : b).timestamp * 1000).toISOString().slice(0, 10)}` : ""}`)
      console.log(`  Dips (<0.33x median): ${dips.length}${dips.length > 0 ? ` — min: $${Math.min(...dips.map((d) => d.value)).toFixed(2)}` : ""}`)
      console.log(`  Zero/negative: ${zeros.length}`)
    }

    // 5. Portfolio snapshots
    const snapshotsBySource = await db.portfolioSnapshot.groupBy({
      by: ["source"],
      where: { userId: user.id },
      _count: true,
      _min: { totalValue: true },
      _max: { totalValue: true },
      _avg: { totalValue: true },
    })
    console.log(`\nPortfolio Snapshots:`)
    for (const s of snapshotsBySource) {
      console.log(`  ${s.source ?? "unknown"}: ${s._count} rows, min=$${s._min.totalValue?.toFixed(2)}, max=$${s._max.totalValue?.toFixed(2)}, avg=$${s._avg.totalValue?.toFixed(2)}`)
    }

    // Detect outlier snapshots
    const allSnapshots = await db.portfolioSnapshot.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: { totalValue: true, source: true, createdAt: true },
    })
    if (allSnapshots.length > 0) {
      const snapValues = allSnapshots.map((s) => s.totalValue).filter((v) => v > 0).sort((a, b) => a - b)
      const snapMedian = snapValues[Math.floor(snapValues.length / 2)]
      const snapSpikes = allSnapshots.filter((s) => s.totalValue > snapMedian * 3)
      const snapDips = allSnapshots.filter((s) => s.totalValue < snapMedian * 0.33 && s.totalValue > 0)
      console.log(`  Median: $${snapMedian?.toFixed(2)}`)
      console.log(`  Spike snapshots (>3x median): ${snapSpikes.length}`)
      if (snapSpikes.length > 0) {
        for (const s of snapSpikes.slice(0, 5)) {
          console.log(`    $${s.totalValue.toFixed(2)} (${s.source}) at ${s.createdAt.toISOString().slice(0, 10)}`)
        }
      }
      console.log(`  Dip snapshots (<0.33x median): ${snapDips.length}`)
      if (snapDips.length > 0) {
        for (const s of snapDips.slice(0, 5)) {
          console.log(`    $${s.totalValue.toFixed(2)} (${s.source}) at ${s.createdAt.toISOString().slice(0, 10)}`)
        }
      }
    }

    // 6. Exchange balance snapshots
    const exchangeSnapshotCount = await db.exchangeBalanceSnapshot.count({ where: { userId: user.id } })
    console.log(`\nExchange Balance Snapshots: ${exchangeSnapshotCount}`)
    if (exchangeSnapshotCount > 0) {
      const exchStats = await db.exchangeBalanceSnapshot.aggregate({
        where: { userId: user.id },
        _min: { totalValue: true, createdAt: true },
        _max: { totalValue: true, createdAt: true },
        _avg: { totalValue: true },
      })
      console.log(`  Min: $${exchStats._min.totalValue?.toFixed(2)}, Max: $${exchStats._max.totalValue?.toFixed(2)}, Avg: $${exchStats._avg.totalValue?.toFixed(2)}`)
      console.log(`  Date range: ${exchStats._min.createdAt?.toISOString().slice(0, 10)} → ${exchStats._max.createdAt?.toISOString().slice(0, 10)}`)
    }

    // 7. Exchange transactions
    const exchangeTxCount = await db.exchangeTransactionCache.count({ where: { userId: user.id } })
    console.log(`Exchange Transactions: ${exchangeTxCount}`)

    // 8. Transaction cache
    const txCount = await db.transactionCache.count({ where: { userId: user.id } })
    console.log(`\nTransaction Cache: ${txCount} rows`)

    // 9. Sync states
    const syncStates = await db.transactionSyncState.findMany({
      where: { userId: user.id },
      select: { walletAddress: true, chain: true, isComplete: true, phase: true, recordsInserted: true, updatedAt: true, lastErrorCode: true },
    })
    const complete = syncStates.filter((s) => s.isComplete)
    const incomplete = syncStates.filter((s) => !s.isComplete)
    console.log(`Sync States: ${syncStates.length} total, ${complete.length} complete, ${incomplete.length} incomplete`)
    for (const s of incomplete.slice(0, 5)) {
      console.log(`  INCOMPLETE: ${s.walletAddress.slice(0, 12)}... (${s.chain}) phase=${s.phase} records=${s.recordsInserted} error=${s.lastErrorCode || "none"}`)
    }

    // 10. History sync jobs
    const syncJobs = await db.historySyncJob.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, status: true, strategy: true, insertedTxCount: true, updatedAt: true, error: true },
    })
    console.log(`\nHistory Sync Jobs (last 3):`)
    for (const j of syncJobs) {
      console.log(`  ${j.id.slice(0, 8)} status=${j.status} strategy=${j.strategy} txs=${j.insertedTxCount} updated=${j.updatedAt.toISOString().slice(0, 19)}${j.error ? ` error=${j.error}` : ""}`)
    }

    // 11. Portfolio settings
    const settings = await db.portfolioSetting.findUnique({
      where: { userId: user.id },
      select: { settings: true },
    })
    if (settings?.settings && typeof settings.settings === "object") {
      const s = settings.settings as Record<string, unknown>
      console.log(`\nPortfolio Settings:`)
      console.log(`  chartWalletFingerprint: ${typeof s.chartWalletFingerprint === "string" ? s.chartWalletFingerprint.slice(0, 30) + "..." : "not set"}`)
      console.log(`  chartCacheUpdatedAt: ${s.chartCacheUpdatedAt ?? "not set"}`)
      console.log(`  chartWipedAt: ${s.chartWipedAt ?? "not set"}`)
    }

    // 12. Refresh jobs
    const refreshJobs = await db.portfolioRefreshJob.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 3,
      select: { id: true, status: true, reason: true, updatedAt: true },
    })
    console.log(`\nRefresh Jobs (last 3):`)
    for (const j of refreshJobs) {
      console.log(`  ${j.id.slice(0, 8)} status=${j.status} reason=${j.reason} updated=${j.updatedAt.toISOString().slice(0, 19)}`)
    }
  }

  console.log("\n=== Diagnostics Complete ===")
  await db.$disconnect()
}

main().catch((e) => {
  console.error("Diagnostic error:", e)
  process.exit(1)
})
