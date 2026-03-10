import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { reconstructPortfolioHistory } from "@/lib/portfolio/value-reconstructor"

// Override db singleton with the right adapter
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const users = await db.user.findMany({ select: { id: true, displayName: true } })
  console.log(`Found ${users.length} user(s)`)

  for (const user of users) {
    console.log(`\nReconstructing for user: ${user.displayName ?? user.id}`)
    const result = await reconstructPortfolioHistory(user.id)
    console.log(`  Snapshots created: ${result.snapshotsCreated}`)
    console.log(`  Price resolution: ${result.priceResolution.resolved} resolved, ${result.priceResolution.failed} failed / ${result.priceResolution.total} total`)
  }
}

main().finally(() => db.$disconnect())
