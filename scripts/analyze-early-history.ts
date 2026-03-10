/**
 * Analyze early wallet history and exchange data for chart ramp-up debugging.
 * Run: npx dotenv-cli -- npx tsx scripts/analyze-early-history.ts
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) { console.log("No user"); return }

  // 1. Exchange balance snapshots
  const exchSnaps = await db.exchangeBalanceSnapshot.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { totalValue: true, createdAt: true },
  })
  console.log("=== Exchange Balance Snapshots ===")
  console.log("Count:", exchSnaps.length)
  if (exchSnaps.length > 0) {
    console.log("Range:", exchSnaps[0].createdAt.toISOString().slice(0, 10), "→", exchSnaps[exchSnaps.length - 1].createdAt.toISOString().slice(0, 10))
    for (const s of exchSnaps.slice(0, 5)) console.log("  ", s.createdAt.toISOString().slice(0, 10), s.exchange, "$" + s.totalValue.toFixed(0))
    if (exchSnaps.length > 8) console.log("  ...")
    for (const s of exchSnaps.slice(-3)) console.log("  ", s.createdAt.toISOString().slice(0, 10), s.exchange, "$" + s.totalValue.toFixed(0))
  }

  // 2. Exchange transactions
  const exchTxs = await db.exchangeTransactionCache.findMany({
    where: { userId: user.id },
    orderBy: { timestamp: "asc" },
    select: { type: true, currency: true, amount: true, timestamp: true, exchangeLabel: true, usdValue: true },
  })
  console.log("\n=== Exchange Transactions ===")
  console.log("Count:", exchTxs.length)
  const withdrawals = exchTxs.filter((t) => t.type === "withdrawal")
  const deposits = exchTxs.filter((t) => t.type === "deposit")
  console.log("Withdrawals (exchange → wallet):", withdrawals.length)
  console.log("Deposits (wallet → exchange):", deposits.length)
  console.log("\nFirst 15 withdrawals:")
  for (const w of withdrawals.slice(0, 15)) {
    console.log("  ", new Date(w.timestamp * 1000).toISOString().slice(0, 10), w.exchangeLabel, w.currency, "amt=" + (w.amount ?? 0).toFixed(2), "usd=$" + (w.usdValue ?? 0).toFixed(0))
  }
  console.log("\nAll exchange txs by month:")
  const monthlyExch = new Map<string, { wCount: number; dCount: number; wTotal: number; dTotal: number }>()
  for (const tx of exchTxs) {
    const month = new Date(tx.timestamp * 1000).toISOString().slice(0, 7)
    const m = monthlyExch.get(month) ?? { wCount: 0, dCount: 0, wTotal: 0, dTotal: 0 }
    if (tx.type === "withdrawal") { m.wCount++; m.wTotal += tx.usdValue ?? tx.amount ?? 0 }
    else { m.dCount++; m.dTotal += tx.usdValue ?? tx.amount ?? 0 }
    monthlyExch.set(month, m)
  }
  for (const [month, m] of [...monthlyExch.entries()].sort()) {
    console.log(`  ${month}: ${m.wCount} withdrawals ($${m.wTotal.toFixed(0)}), ${m.dCount} deposits ($${m.dTotal.toFixed(0)})`)
  }

  // 3. On-chain incoming transactions May-Jun
  const mayStart = Math.floor(new Date("2025-05-01").getTime() / 1000)
  const junEnd = Math.floor(new Date("2025-07-01").getTime() / 1000)
  const earlyTxs = await db.transactionCache.findMany({
    where: {
      userId: user.id,
      blockTimestamp: { gte: mayStart, lt: junEnd },
      direction: "in",
      category: { in: ["external", "erc20"] },
    },
    orderBy: { blockTimestamp: "asc" },
    select: { symbol: true, value: true, usdValue: true, blockTimestamp: true, chain: true, txClassification: true },
  })
  console.log("\n=== Incoming On-Chain Transactions May-Jun 2025 ===")
  console.log("Count:", earlyTxs.length)

  // Show the big ones (>$1000)
  const bigOnes = earlyTxs.filter((tx) => (tx.usdValue ?? 0) > 1000)
  console.log("Big incoming (>$1k):")
  for (const tx of bigOnes) {
    const date = new Date(tx.blockTimestamp * 1000).toISOString().slice(0, 10)
    console.log(`  ${date} ${tx.chain} ${tx.symbol} amt=${tx.value?.toFixed(2)} usd=$${(tx.usdValue ?? 0).toFixed(0)} class=${tx.txClassification ?? "null"}`)
  }

  // 4. Reconstructed values May-Jun
  const maySnaps = await db.portfolioSnapshot.findMany({
    where: { userId: user.id, source: "reconstructed", createdAt: { gte: new Date("2025-05-01"), lt: new Date("2025-07-01") } },
    orderBy: { createdAt: "asc" },
    select: { totalValue: true, createdAt: true },
  })
  console.log("\n=== Reconstructed Values May-Jun ===")
  for (const s of maySnaps) {
    console.log("  ", s.createdAt.toISOString().slice(0, 10), "$" + s.totalValue.toFixed(0))
  }

  // 5. Projected chart values for same period
  const projMay = await db.projectedChartCache.findMany({
    where: { userId: user.id, timestamp: { gte: mayStart, lt: junEnd } },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, value: true },
  })
  console.log("\n=== Projected Chart May-Jun ===")
  console.log("Count:", projMay.length)
  if (projMay.length > 0) {
    console.log("  First:", new Date(projMay[0].timestamp * 1000).toISOString().slice(0, 10), "$" + projMay[0].value.toFixed(0))
    console.log("  Last:", new Date(projMay[projMay.length - 1].timestamp * 1000).toISOString().slice(0, 10), "$" + projMay[projMay.length - 1].value.toFixed(0))
  }

  // 6. Unclassified transactions count
  const unclassified = await db.transactionCache.count({
    where: { userId: user.id, txClassification: null },
  })
  const total = await db.transactionCache.count({ where: { userId: user.id } })
  console.log(`\n=== Classification Stats ===`)
  console.log(`Total txs: ${total}, Unclassified: ${unclassified} (${(unclassified / total * 100).toFixed(1)}%)`)

  await db.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
