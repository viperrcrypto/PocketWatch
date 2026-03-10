import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  // Reset ZERION_MULTI sync state to re-trigger full fetch
  const result = await db.transactionSyncState.updateMany({
    where: { chain: "ZERION_MULTI" },
    data: {
      isComplete: false,
      phase: "bootstrap",
      pageKey: null,
      requestsProcessed: 0,
      recordsInserted: 0,
      retryAfter: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      highWaterMark: null,
      syncMode: "historical",
    },
  })
  console.log(`Reset ${result.count} ZERION_MULTI sync state(s)`)

  // Also reset any active history sync jobs so the worker picks it up
  const jobs = await db.historySyncJob.updateMany({
    where: { status: { in: ["completed", "partial"] } },
    data: { status: "queued", completedAt: null, error: null },
  })
  console.log(`Reset ${jobs.count} history sync job(s) to queued`)

  // Verify
  const states = await db.transactionSyncState.findMany({
    where: { chain: "ZERION_MULTI" },
    select: { walletAddress: true, phase: true, isComplete: true, requestsProcessed: true },
  })
  for (const s of states) {
    console.log(`  ${s.walletAddress.slice(0, 12)}… phase=${s.phase} complete=${s.isComplete} reqs=${s.requestsProcessed}`)
  }
}

main().finally(() => db.$disconnect())
