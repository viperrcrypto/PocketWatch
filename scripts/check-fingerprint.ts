import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) })

async function main() {
  const snap = await db.portfolioSnapshot.findFirst({
    where: { source: "reconstructed" },
    select: { metadata: true },
  })

  console.log("Raw metadata type:", typeof snap?.metadata)
  console.log("Raw metadata:", JSON.stringify(snap?.metadata).slice(0, 200))

  // Try parsing if it's a string
  let parsed = snap?.metadata
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed) } catch {}
  }
  console.log("Parsed metadata:", parsed)
  console.log("walletFingerprint:", (parsed as Record<string, unknown>)?.walletFingerprint)

  const wallets = await db.trackedWallet.findMany({ select: { address: true } })
  const sorted = wallets.map((w) => w.address).sort((a, b) => a.localeCompare(b))
  const normalize = (a: string) => a.startsWith("0x") ? a.toLowerCase() : a
  const normalized = sorted.map(normalize)
  const routeFp = normalized.join("|")

  console.log("\nRoute fingerprint:", routeFp)

  const count = await db.portfolioSnapshot.count({ where: { source: "reconstructed" } })
  console.log("Reconstructed snapshots:", count)
}

main().finally(() => db.$disconnect())
