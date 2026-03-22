import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error("Need DATABASE_URL"); process.exit(1) }

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) })

async function main() {
  const wallets = await db.trackedWallet.findMany({
    select: { address: true, chains: true, isActive: true },
  })
  console.log("Total tracked wallets:", wallets.length)
  console.log("Active:", wallets.filter((w) => w.isActive).length)
  console.log("Inactive:", wallets.filter((w) => !w.isActive).length)

  // EVM vs Solana vs BTC
  let evm = 0, sol = 0, btc = 0
  for (const w of wallets) {
    if (w.chains.includes("SOL")) sol++
    else if (w.chains.includes("BTC")) btc++
    else evm++
  }
  console.log(`\nBy type: EVM=${evm}, Solana=${sol}, BTC=${btc}`)

  // Sync states
  const syncStates = await db.transactionSyncState.count()
  const completeSyncs = await db.transactionSyncState.count({ where: { isComplete: true } })
  const distinctWallets = await db.transactionSyncState.findMany({
    select: { walletAddress: true },
    distinct: ["walletAddress"],
  })
  console.log("\nSync states total:", syncStates)
  console.log("Sync states complete:", completeSyncs)
  console.log("Sync states pending:", syncStates - completeSyncs)
  console.log("Distinct wallets with sync states:", distinctWallets.length)

  // Show a few wallet addresses from sync states vs tracked wallets
  console.log("\nSample sync state wallets:")
  for (const w of distinctWallets.slice(0, 5)) {
    console.log(" ", w.walletAddress.slice(0, 12) + "...")
  }

  // Check if sync states exist for newly imported wallets
  const trackedAddrs = new Set(wallets.map((w) => w.address.toLowerCase()))
  const syncAddrs = new Set(distinctWallets.map((w) => w.walletAddress.toLowerCase()))
  const trackedWithoutSync = [...trackedAddrs].filter((a) => !syncAddrs.has(a))
  console.log("\nTracked wallets WITHOUT sync states:", trackedWithoutSync.length)
  if (trackedWithoutSync.length > 0) {
    console.log("First 5:", trackedWithoutSync.slice(0, 5).map((a) => a.slice(0, 12) + "..."))
  }

  // Check history sync job
  const jobs = await db.historySyncJob.findMany({
    orderBy: { updatedAt: "desc" },
    take: 3,
    select: { id: true, status: true, totalSteps: true, completedSteps: true, updatedAt: true },
  })
  console.log("\nRecent history sync jobs:")
  for (const j of jobs) {
    console.log(`  ${j.id.slice(0, 8)}... status=${j.status} progress=${j.completedSteps}/${j.totalSteps} updated=${j.updatedAt.toISOString()}`)
  }

  await db.$disconnect()
}
main()
