import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const wallets = await db.trackedWallet.findMany({ select: { address: true } })
  const solWallet = wallets.find((w) => !w.address.startsWith("0x"))
  if (!solWallet) { console.log("No Solana wallet found"); return }

  const orig = solWallet.address
  const lower = orig.toLowerCase()
  const [countOrig, countLower, sampleAddr] = await Promise.all([
    db.transactionCache.count({ where: { walletAddress: orig } }),
    db.transactionCache.count({ where: { walletAddress: lower } }),
    db.transactionCache.findFirst({ select: { walletAddress: true } }),
  ])

  console.log("trackedWallet.address (original):", orig)
  console.log("lowercase version:               ", lower)
  console.log("TxCache matches original case:   ", countOrig)
  console.log("TxCache matches lowercase:       ", countLower)
  console.log("Sample TxCache walletAddress:    ", sampleAddr?.walletAddress)
  console.log("")
  if (countOrig > 0 && countLower === 0) {
    console.log("BUG CONFIRMED: Reconstructor lowercases Solana address but TxCache stores original case")
    console.log("→ reconstructor query finds 0 transactions → 0 snapshots → empty chart")
  } else if (countLower > 0) {
    console.log("Address case is fine (lowercase matches)")
  }
}

main().finally(() => db.$disconnect())
