import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const toDate = (ts: bigint | null | undefined) =>
    ts ? new Date(Number(ts) * 1000).toISOString().slice(0, 10) : "null"

  // Check EVM wallet transactions
  const evmWallets = await db.trackedWallet.findMany({
    where: { address: { startsWith: "0x" } },
    select: { address: true, label: true },
  })

  const [totalTx, snapshots, snapshotSources, solPriced, solUnpriced] = await Promise.all([
    db.transactionCache.count(),
    db.portfolioSnapshot.count({ where: { source: "reconstructed" } }),
    db.portfolioSnapshot.groupBy({ by: ["source"], _count: true }),
    // SOL transactions with a real USD value
    db.transactionCache.count({ where: { chain: "SOLANA", usdValue: { not: null, gt: 0 } } }),
    // SOL transactions with null/zero USD value
    db.transactionCache.count({ where: { chain: "SOLANA", OR: [{ usdValue: null }, { usdValue: 0 }] } }),
  ])

  console.log("=== EVM Wallets ===")
  for (const w of evmWallets) {
    const evmTxCount = await db.transactionCache.count({ where: { walletAddress: w.address.toLowerCase() } })
    const zerionState = await db.transactionSyncState.findFirst({
      where: { walletAddress: w.address.toLowerCase(), chain: "ZERION_MULTI" },
      select: { phase: true, isComplete: true, requestsProcessed: true, lastErrorCode: true, recordsInserted: true },
    })
    console.log(`  ${w.address.slice(0, 12)}… "${w.label ?? "unnamed"}"`)
    console.log(`    TxCache: ${evmTxCount} transactions`)
    console.log(`    ZerionState: phase=${zerionState?.phase} complete=${zerionState?.isComplete} reqs=${zerionState?.requestsProcessed} inserted=${zerionState?.recordsInserted} err=${zerionState?.lastErrorCode ?? "-"}`)
  }

  console.log("\n=== SOL Price Coverage ===")
  console.log(`  With USD value (>0): ${solPriced}`)
  console.log(`  Missing USD value:   ${solUnpriced}`)
  if (solUnpriced > solPriced) {
    console.log("  ⚠️  Most SOL txns have no USD price — reconstructor can't build historical chart")
    console.log("     The price-resolver (DeFiLlama) needs to fill these in")
  }

  console.log("\n=== Portfolio Snapshots ===")
  for (const s of snapshotSources) {
    console.log(`  source=${s.source ?? "null"}: ${s._count}`)
  }
  console.log(`  Reconstructed: ${snapshots}`)
  if (snapshots < 30) {
    console.log("  ⚠️  Not enough for a meaningful chart — reconstruction needs priced transactions")
  }

  // Sample 5 oldest SOL transactions to see their structure
  console.log("\n=== Sample SOL Transactions (oldest 5) ===")
  const sample = await db.transactionCache.findMany({
    where: { chain: "SOLANA" },
    orderBy: { blockTimestamp: "asc" },
    take: 5,
    select: { blockTimestamp: true, symbol: true, value: true, usdValue: true, direction: true, category: true },
  })
  for (const t of sample) {
    console.log(`  ${toDate(t.blockTimestamp)} ${t.direction} ${String(t.symbol).padEnd(8)} qty=${t.value?.toFixed(4) ?? "?"} usd=${t.usdValue?.toFixed(2) ?? "null"} cat=${t.category}`)
  }
}

main().finally(() => db.$disconnect())
