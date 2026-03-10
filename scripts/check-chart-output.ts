/**
 * Simulate what the TOTAL chart shows: reconstructed + exchange blend.
 * Run: npx dotenv-cli -- npx tsx scripts/check-chart-output.ts
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { interpolateExchangeValue } from "../src/lib/portfolio/snapshot-helpers"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) return

  // Reconstructed snapshots (the backbone of the chart after Zerion suppression)
  const reconstructed = await db.portfolioSnapshot.findMany({
    where: { userId: user.id, source: "reconstructed" },
    orderBy: { createdAt: "asc" },
    select: { totalValue: true, createdAt: true },
  })

  // Exchange balance snapshots
  const exchSnaps = await db.exchangeBalanceSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { totalValue: true, createdAt: true },
  })

  // Build exchange timeline
  const exchangeByDay = new Map<number, { timestamp: number; value: number }>()
  for (const snap of exchSnaps) {
    const ts = Math.floor(snap.createdAt.getTime() / 1000)
    const day = Math.floor(ts / 86400)
    const existing = exchangeByDay.get(day)
    if (!existing || ts > existing.timestamp) {
      exchangeByDay.set(day, { timestamp: ts, value: snap.totalValue })
    }
  }
  const exchangeTimeline = Array.from(exchangeByDay.values()).sort((a, b) => a.timestamp - b.timestamp)
  console.log(`Exchange timeline: ${exchangeTimeline.length} days, ${exchangeTimeline.length > 0 ? new Date(exchangeTimeline[0].timestamp * 1000).toISOString().slice(0, 10) + ' → ' + new Date(exchangeTimeline[exchangeTimeline.length - 1].timestamp * 1000).toISOString().slice(0, 10) : 'empty'}`)

  // Simulate blending
  console.log("\n=== Chart Values (Reconstructed + Exchange Blend) ===")
  console.log("Date        | Recon     | Exchange | Total    | Source")
  console.log("------------|-----------|----------|----------|-------")

  // Sample monthly + last 10 days
  const sampleDates = new Set<string>()
  // First and last of each month
  for (const s of reconstructed) {
    const d = s.createdAt.toISOString().slice(0, 10)
    const month = d.slice(0, 7)
    if (!sampleDates.has(month + "-first")) {
      sampleDates.add(month + "-first")
      const ts = Math.floor(s.createdAt.getTime() / 1000)
      const exchVal = interpolateExchangeValue(ts, exchangeTimeline)
      console.log(`${d}  | $${s.totalValue.toFixed(0).padStart(7)} | $${exchVal.toFixed(0).padStart(6)} | $${(s.totalValue + exchVal).toFixed(0).padStart(7)} | first of ${month}`)
    }
  }

  console.log("\n--- Last 10 reconstructed values ---")
  for (const s of reconstructed.slice(-10)) {
    const d = s.createdAt.toISOString().slice(0, 10)
    const ts = Math.floor(s.createdAt.getTime() / 1000)
    const exchVal = interpolateExchangeValue(ts, exchangeTimeline)
    console.log(`${d}  | $${s.totalValue.toFixed(0).padStart(7)} | $${exchVal.toFixed(0).padStart(6)} | $${(s.totalValue + exchVal).toFixed(0).padStart(7)}`)
  }

  // Live refresh for comparison
  const live = await db.portfolioSnapshot.findMany({
    where: { userId: user.id, source: "live_refresh" },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { totalValue: true, createdAt: true, metadata: true },
  })
  console.log("\n--- Latest live_refresh ---")
  for (const l of live) {
    const meta = typeof l.metadata === "object" ? l.metadata as Record<string, unknown> : null
    const onchain = meta?.onchainTotalValue as number | undefined
    const exchange = meta?.exchangeTotalValue as number | undefined
    console.log(`${l.createdAt.toISOString().slice(0, 19)} total=$${l.totalValue.toFixed(0)} onchain=$${(onchain ?? 0).toFixed(0)} exchange=$${(exchange ?? 0).toFixed(0)}`)
  }

  await db.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
