/**
 * Clean up known bad snapshots from partial wallet fetches.
 * Run with: set -a && source .env && npx tsx scripts/cleanup-bad-snapshots.ts
 */
import { db } from "../src/lib/db"

async function main() {
  const user = await db.user.findFirst({ select: { id: true, username: true } })
  if (!user) {
    console.log("No user found")
    return
  }
  console.log(`User: ${user.username} (${user.id})`)

  // Find live_refresh snapshots that are likely partial fetches
  // (significantly lower than the median of recent live snapshots)
  const liveSnapshots = await db.portfolioSnapshot.findMany({
    where: { userId: user.id, source: "live_refresh" },
    orderBy: { createdAt: "desc" },
    select: { id: true, totalValue: true, createdAt: true },
  })

  if (liveSnapshots.length < 2) {
    console.log("Not enough live snapshots to detect outliers")
    return
  }

  const values = liveSnapshots.map((s) => s.totalValue).sort((a, b) => a - b)
  const median = values[Math.floor(values.length / 2)]
  console.log(`Live snapshot median: $${median.toFixed(0)} (${liveSnapshots.length} total)`)

  const badOnes = liveSnapshots.filter((s) => s.totalValue < median * 0.5)
  if (badOnes.length === 0) {
    console.log("No bad snapshots found")
  } else {
    for (const s of badOnes) {
      console.log(`Deleting bad snapshot: $${s.totalValue.toFixed(0)} from ${s.createdAt.toISOString()}`)
      await db.portfolioSnapshot.delete({ where: { id: s.id } })
    }
    console.log(`Deleted ${badOnes.length} bad snapshot(s)`)
  }

  await db.$disconnect()
}

main().catch(console.error)
