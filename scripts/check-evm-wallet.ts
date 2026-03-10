import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  // Find EVM wallet
  const wallets = await db.trackedWallet.findMany({ select: { address: true, label: true } })
  const evmWallet = wallets.find((w) => w.address.startsWith("0x"))
  if (!evmWallet) { console.log("No EVM wallet"); return }

  const addr = evmWallet.address
  const addrLower = addr.toLowerCase()
  console.log("EVM wallet address:", addr)
  console.log("Lowercase:", addrLower)

  // Check ALL transactions for this wallet — any case, any category
  const [countOrigCase, countLower, countAny] = await Promise.all([
    db.transactionCache.count({ where: { walletAddress: addr } }),
    db.transactionCache.count({ where: { walletAddress: addrLower } }),
    db.transactionCache.count({ where: { walletAddress: { contains: addrLower.slice(2, 12) } } }),
  ])
  console.log("\nTransactionCache counts:")
  console.log("  Original case:", countOrigCase)
  console.log("  Lowercase:", countLower)
  console.log("  Contains addr fragment:", countAny)

  // Check sync states for this wallet
  const syncStates = await db.transactionSyncState.findMany({
    where: { walletAddress: { in: [addr, addrLower] } },
    select: {
      walletAddress: true,
      chain: true,
      phase: true,
      isComplete: true,
      requestsProcessed: true,
      recordsInserted: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      syncMode: true,
      highWaterMark: true,
    },
  })
  console.log("\nSync states:")
  for (const s of syncStates) {
    console.log(`  chain=${s.chain} phase=${s.phase} complete=${s.isComplete}`)
    console.log(`    requests=${s.requestsProcessed} inserted=${s.recordsInserted}`)
    console.log(`    syncMode=${s.syncMode} hwm=${s.highWaterMark}`)
    console.log(`    error=${s.lastErrorCode ?? "-"} msg=${s.lastErrorMessage?.slice(0, 100) ?? "-"}`)
  }

  // Check total tx by category
  const categories = await db.transactionCache.groupBy({
    by: ["category"],
    where: { walletAddress: addrLower },
    _count: true,
  })
  console.log("\nTransactions by category:")
  for (const c of categories) {
    console.log(`  ${c.category}: ${c._count}`)
  }

  // Sample the most recent transactions regardless of wallet
  console.log("\n5 most recent EVM transactions (any wallet):")
  const recent = await db.transactionCache.findMany({
    where: { chain: { not: "SOLANA" } },
    orderBy: { blockTimestamp: "desc" },
    take: 5,
    select: { walletAddress: true, chain: true, category: true, symbol: true, blockTimestamp: true },
  })
  for (const t of recent) {
    console.log(`  wallet=${t.walletAddress.slice(0, 12)}… chain=${t.chain} cat=${t.category} sym=${t.symbol} ts=${t.blockTimestamp}`)
  }
}

main().finally(() => db.$disconnect())
