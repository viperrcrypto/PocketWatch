/**
 * Seeds fake demo portfolio (crypto) snapshots for the PocketWatch demo.
 * Run after wiping real PortfolioSnapshot data.
 *
 * Run: npx tsx scripts/seed-portfolio-snapshots.ts
 */
import "dotenv/config"
import { db } from "../src/lib/db"

const USER_ID = process.env.DEMO_USER_ID ?? ""
if (!USER_ID) throw new Error("Set DEMO_USER_ID in .env to run the demo seeder.")

async function main() {
  const deleted = await db.portfolioSnapshot.deleteMany({ where: { userId: USER_ID } })
  console.log(`🗑  Deleted ${deleted.count} existing snapshots`)

  // Fake crypto portfolio growth narrative: Q4 2024 bull run → consolidation → breakout
  const snapshots = [
    // Q4 2024 - market warming up
    { date: new Date("2024-10-01"), totalValue: 42300 },
    { date: new Date("2024-10-15"), totalValue: 44800 },
    { date: new Date("2024-11-01"), totalValue: 51200 },
    { date: new Date("2024-11-15"), totalValue: 58900 },
    { date: new Date("2024-12-01"), totalValue: 67400 },
    { date: new Date("2024-12-15"), totalValue: 74200 },
    { date: new Date("2024-12-31"), totalValue: 82100 },
    // Q1 2025 - consolidation
    { date: new Date("2025-01-15"), totalValue: 78600 },
    { date: new Date("2025-02-01"), totalValue: 75300 },
    { date: new Date("2025-02-15"), totalValue: 81400 },
    { date: new Date("2025-03-01"), totalValue: 88200 },
    { date: new Date("2025-03-15"), totalValue: 84700 },
    // Q2 2025 - breakout
    { date: new Date("2025-04-01"), totalValue: 91500 },
    { date: new Date("2025-04-15"), totalValue: 98300 },
    { date: new Date("2025-05-01"), totalValue: 107800 },
    { date: new Date("2025-05-15"), totalValue: 114200 },
    { date: new Date("2025-06-01"), totalValue: 122400 },
    // Q3 2025 - pullback then recovery
    { date: new Date("2025-07-01"), totalValue: 109600 },
    { date: new Date("2025-07-15"), totalValue: 103200 },
    { date: new Date("2025-08-01"), totalValue: 116700 },
    { date: new Date("2025-08-15"), totalValue: 128900 },
    { date: new Date("2025-09-01"), totalValue: 137400 },
    // Q4 2025 - strong run
    { date: new Date("2025-10-01"), totalValue: 148200 },
    { date: new Date("2025-10-15"), totalValue: 162800 },
    { date: new Date("2025-11-01"), totalValue: 178400 },
    { date: new Date("2025-11-15"), totalValue: 191600 },
    { date: new Date("2025-12-01"), totalValue: 204300 },
    { date: new Date("2025-12-15"), totalValue: 218700 },
    { date: new Date("2025-12-31"), totalValue: 234100 },
    // 2026 - current
    { date: new Date("2026-01-15"), totalValue: 241800 },
    { date: new Date("2026-02-01"), totalValue: 238400 },
    { date: new Date("2026-02-15"), totalValue: 252700 },
    { date: new Date("2026-03-01"), totalValue: 261300 },
    { date: new Date("2026-03-12"), totalValue: 268450 },
  ]

  for (const s of snapshots) {
    await db.portfolioSnapshot.create({
      data: { userId: USER_ID, createdAt: s.date, totalValue: s.totalValue, metadata: "{}" },
    })
  }
  console.log(`✅ Created ${snapshots.length} demo portfolio snapshots`)
}

main().catch(console.error).finally(() => db.$disconnect())
