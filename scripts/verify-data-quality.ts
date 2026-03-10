/**
 * Post-fix data quality verification.
 * Checks all chart data sources for anomalies.
 * Run: npx tsx scripts/verify-data-quality.ts
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

interface Issue { severity: "PASS" | "WARN" | "FAIL"; check: string; detail: string }

async function main() {
  const issues: Issue[] = []
  const userId = (await db.user.findFirst({ select: { id: true } }))?.id
  if (!userId) { console.log("No users found"); return }

  // 1. ChartCache: no extreme values
  const chartPoints = await db.chartCache.findMany({
    where: { userId },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, value: true },
  })
  if (chartPoints.length > 0) {
    const values = chartPoints.map((p) => p.value)
    const nonZero = values.filter((v) => v > 0)
    const sorted = [...nonZero].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const zeros = values.filter((v) => v <= 0)
    const negatives = values.filter((v) => v < 0)
    const nans = values.filter((v) => !Number.isFinite(v))
    const extreme = values.filter((v) => v > median * 10)

    issues.push({ severity: zeros.length === 0 ? "PASS" : "FAIL", check: "ChartCache zero values", detail: `${zeros.length} found` })
    issues.push({ severity: negatives.length === 0 ? "PASS" : "FAIL", check: "ChartCache negative values", detail: `${negatives.length} found` })
    issues.push({ severity: nans.length === 0 ? "PASS" : "FAIL", check: "ChartCache NaN/Infinity", detail: `${nans.length} found` })
    issues.push({ severity: extreme.length === 0 ? "PASS" : "WARN", check: "ChartCache extreme values (>10x median)", detail: `${extreme.length} found (median=$${median.toFixed(0)})` })

    // Day-over-day check
    let maxJump = 0
    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] > 0) {
        const jump = Math.max(values[i] / values[i - 1], values[i - 1] / values[i])
        if (jump > maxJump) maxJump = jump
      }
    }
    issues.push({ severity: maxJump < 3 ? "PASS" : maxJump < 5 ? "WARN" : "FAIL", check: "ChartCache max point-to-point change", detail: `${maxJump.toFixed(2)}x` })
  } else {
    issues.push({ severity: "WARN", check: "ChartCache", detail: "empty — will rebuild on next load" })
  }

  // 2. PortfolioSnapshots: no outliers
  const snapshots = await db.portfolioSnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { totalValue: true, source: true },
  })
  if (snapshots.length > 0) {
    const vals = snapshots.map((s) => s.totalValue).filter((v) => v > 0)
    const sorted = [...vals].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const spikes = snapshots.filter((s) => s.totalValue > median * 5)
    const dips = snapshots.filter((s) => s.totalValue < median * 0.1 && s.totalValue > 0)
    const zeros = snapshots.filter((s) => s.totalValue <= 0)

    issues.push({ severity: spikes.length === 0 ? "PASS" : "FAIL", check: "Snapshots spikes (>5x median)", detail: `${spikes.length} found (median=$${median.toFixed(0)})` })
    issues.push({ severity: dips.length === 0 ? "PASS" : "FAIL", check: "Snapshots dips (<0.1x median)", detail: `${dips.length} found` })
    issues.push({ severity: zeros.length === 0 ? "PASS" : "WARN", check: "Snapshots zero/negative", detail: `${zeros.length} found` })
  }

  // 3. ExchangeBalanceSnapshots: no zeros, reasonable range
  const exchSnaps = await db.exchangeBalanceSnapshot.findMany({
    where: { userId },
    select: { totalValue: true },
  })
  if (exchSnaps.length > 0) {
    const zeros = exchSnaps.filter((s) => s.totalValue <= 0)
    const nans = exchSnaps.filter((s) => !Number.isFinite(s.totalValue))
    issues.push({ severity: exchSnaps.length > 5 ? "PASS" : "WARN", check: "Exchange snapshots count", detail: `${exchSnaps.length} entries` })
    issues.push({ severity: zeros.length === 0 ? "PASS" : "FAIL", check: "Exchange snapshots zeros", detail: `${zeros.length} found` })
    issues.push({ severity: nans.length === 0 ? "PASS" : "FAIL", check: "Exchange snapshots NaN", detail: `${nans.length} found` })
  } else {
    issues.push({ severity: "WARN", check: "Exchange snapshots", detail: "none — will reconstruct on TOTAL chart load" })
  }

  // 4. Sync completeness
  const syncStates = await db.transactionSyncState.findMany({
    where: { userId },
    select: { isComplete: true },
  })
  const incomplete = syncStates.filter((s) => !s.isComplete)
  issues.push({ severity: incomplete.length === 0 ? "PASS" : "WARN", check: "Sync completeness", detail: `${syncStates.length - incomplete.length}/${syncStates.length} complete` })

  // 5. Settings state
  const setting = await db.portfolioSetting.findUnique({
    where: { userId },
    select: { settings: true },
  })
  const s = setting?.settings as Record<string, unknown> | undefined
  issues.push({ severity: !s?.chartWipedAt ? "PASS" : "FAIL", check: "Chart wipe marker cleared", detail: s?.chartWipedAt ? "STILL SET — chart is blocked!" : "cleared" })
  issues.push({ severity: s?.chartWalletFingerprint ? "PASS" : "WARN", check: "Wallet fingerprint set", detail: s?.chartWalletFingerprint ? "set" : "not set" })

  // Print results
  console.log("\n=== Data Quality Verification ===\n")
  const counts = { PASS: 0, WARN: 0, FAIL: 0 }
  for (const issue of issues) {
    const icon = issue.severity === "PASS" ? "OK" : issue.severity === "WARN" ? "!!" : "XX"
    console.log(`  [${icon}] ${issue.check}: ${issue.detail}`)
    counts[issue.severity]++
  }
  console.log(`\n  Summary: ${counts.PASS} passed, ${counts.WARN} warnings, ${counts.FAIL} failures`)
  console.log(counts.FAIL === 0 ? "\n  DATA QUALITY: HEALTHY" : "\n  DATA QUALITY: ISSUES FOUND")

  await db.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
