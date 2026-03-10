import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

function normalizeWalletAddress(addr: string): string {
  return addr.startsWith("0x") ? addr.toLowerCase() : addr
}

async function main() {
  const user = await db.user.findFirst({ select: { id: true } })
  if (!user) return

  const wallets = await db.trackedWallet.findMany({
    where: { userId: user.id },
    select: { address: true },
    orderBy: { createdAt: "asc" },
  })
  const addresses = wallets.map((w) => w.address).sort((a, b) => a.localeCompare(b))
  const normalizedAddresses = addresses.map(normalizeWalletAddress)
  const walletFingerprint = normalizedAddresses.join("|")

  console.log("Wallet fingerprint:", walletFingerprint)

  // Check sync states
  const syncStates = await db.transactionSyncState.findMany({
    where: { userId: user.id },
    select: { walletAddress: true, isComplete: true },
  })
  const completedSyncWallets = new Set(
    syncStates.filter((s) => s.isComplete).map((s) => normalizeWalletAddress(s.walletAddress))
  )
  console.log("Sync states:", syncStates.length, "complete:", syncStates.filter(s => s.isComplete).length)
  console.log("Incomplete:", syncStates.filter(s => !s.isComplete).length)

  // Coverage
  const coverageRows = await db.transactionCache.groupBy({
    by: ["walletAddress"],
    where: { userId: user.id, walletAddress: { in: normalizedAddresses } },
    _min: { blockTimestamp: true },
  })
  const coverageMap = new Map<string, number>()
  for (const row of coverageRows) {
    if (row._min.blockTimestamp) {
      coverageMap.set(normalizeWalletAddress(row.walletAddress), row._min.blockTimestamp)
    }
  }

  console.log("\nCoverage map entries:", coverageMap.size)
  for (const [addr, ts] of coverageMap) {
    console.log(`  ${addr.slice(0, 12)}… from ${new Date(ts * 1000).toISOString().slice(0, 10)}`)
  }

  const hasCoverage = normalizedAddresses.every((a) =>
    coverageMap.has(a) || completedSyncWallets.has(a)
  )
  const walletsWithData = normalizedAddresses.filter((a) => coverageMap.has(a))
  const strictStart = hasCoverage && walletsWithData.length > 0
    ? Math.max(...walletsWithData.map((a) => coverageMap.get(a) ?? 0))
    : null
  console.log("hasCoverageForAllWallets:", hasCoverage)
  console.log("strictCoverageStartSec:", strictStart, strictStart ? new Date(strictStart * 1000).toISOString() : "null")

  // Check snapshot fingerprints
  const snapshots = await db.portfolioSnapshot.findMany({
    where: { userId: user.id, source: "reconstructed" },
    select: { id: true, metadata: true, createdAt: true },
    take: 3,
    orderBy: { createdAt: "asc" },
  })
  console.log("\nReconstructed snapshot sample:")
  for (const s of snapshots) {
    const meta = s.metadata
    console.log(`  id=${s.id.slice(0,8)}… date=${s.createdAt.toISOString().slice(0,10)} meta_type=${typeof meta}`)
    if (typeof meta === "string") {
      // Try parsing
      try {
        const parsed = JSON.parse(meta)
        console.log(`    fingerprint: ${parsed?.walletFingerprint?.slice(0, 40)}…`)
        console.log(`    match: ${parsed?.walletFingerprint === walletFingerprint}`)
      } catch {
        console.log(`    NOT JSON (encrypted?) first 50: ${meta.slice(0, 50)}`)
      }
    } else if (typeof meta === "object" && meta !== null) {
      const fp = (meta as Record<string, unknown>).walletFingerprint
      console.log(`    fingerprint: ${String(fp).slice(0, 40)}…`)
      console.log(`    match: ${fp === walletFingerprint}`)
    }
  }

  // Count what the chart would show
  const allSnapshots = await db.portfolioSnapshot.findMany({
    where: { userId: user.id },
    select: { source: true, totalValue: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
  const reconstructed = allSnapshots.filter(s => s.source === "reconstructed")
  const liveRefresh = allSnapshots.filter(s => s.source === "live_refresh")
  console.log(`\nAll snapshots: ${allSnapshots.length} (${reconstructed.length} reconstructed, ${liveRefresh.length} live_refresh)`)
  if (reconstructed.length > 0) {
    console.log(`Reconstructed range: ${reconstructed[0].createdAt.toISOString().slice(0,10)} → ${reconstructed[reconstructed.length-1].createdAt.toISOString().slice(0,10)}`)
    console.log(`Sample values: ${reconstructed[0].totalValue.toFixed(2)}, ${reconstructed[Math.floor(reconstructed.length/2)].totalValue.toFixed(2)}, ${reconstructed[reconstructed.length-1].totalValue.toFixed(2)}`)
  }
}

main().finally(() => db.$disconnect())
