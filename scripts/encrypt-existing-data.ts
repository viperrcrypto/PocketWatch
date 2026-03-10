/**
 * One-time migration script: encrypt existing plaintext data in-place.
 *
 * Run AFTER the schema migration (Float→Text columns) and BEFORE
 * restarting the app (which expects encrypted data).
 *
 * Usage: npx tsx scripts/encrypt-existing-data.ts
 *
 * Requires ENCRYPTION_KEY and DATABASE_URL in environment.
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { encrypt, isEncryptionConfigured } from "../src/lib/crypto"

const BATCH_SIZE = 100

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error("DATABASE_URL is not set")
  process.exit(1)
}

if (!isEncryptionConfigured()) {
  console.error("ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32")
  process.exit(1)
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })

// Fields to encrypt per model, with their original types for detection
const MODELS: {
  name: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delegate: any
  fields: string[]
}[] = []

function initModels() {
  // Only String and Json fields — Float fields stay plaintext for SQL aggregation
  MODELS.push(
    {
      name: "FinanceTransaction",
      delegate: prisma.financeTransaction,
      fields: ["notes", "location", "paymentMeta", "counterparties", "checkNumber"],
    },
    {
      name: "FinanceAccount",
      delegate: prisma.financeAccount,
      fields: ["officialName"],
    },
    {
      name: "FinanceSnapshot",
      delegate: prisma.financeSnapshot,
      fields: ["breakdown"],
    },
    {
      name: "TrackedWallet",
      delegate: prisma.trackedWallet,
      fields: ["label"],
    },
    {
      name: "BalanceSnapshot",
      delegate: prisma.balanceSnapshot,
      fields: ["positions"],
    },
    {
      name: "PortfolioSnapshot",
      delegate: prisma.portfolioSnapshot,
      fields: ["metadata"],
    },
    {
      name: "AddressLabel",
      delegate: prisma.addressLabel,
      fields: ["name"],
    },
  )
}

function looksEncrypted(value: string): boolean {
  // AES-256-GCM base64: IV(12) + ciphertext + tag(16) = minimum ~40 base64 chars
  // and should be valid base64
  if (value.length < 48) return false
  return /^[A-Za-z0-9+/]+=*$/.test(value)
}

async function encryptValue(value: unknown): Promise<string | null> {
  if (value === null || value === undefined) return null
  const str = typeof value === "object" ? JSON.stringify(value) : String(value)
  // Skip if already looks encrypted
  if (typeof value === "string" && looksEncrypted(value)) {
    return value
  }
  return encrypt(str)
}

async function migrateModel(config: (typeof MODELS)[number]) {
  let cursor: string | undefined
  let totalProcessed = 0

  console.log(`\n[${config.name}] Starting encryption...`)

  while (true) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findArgs: any = {
      take: BATCH_SIZE,
      orderBy: { id: "asc" as const },
    }
    if (cursor) {
      findArgs.skip = 1
      findArgs.cursor = { id: cursor }
    }

    const rows = await config.delegate.findMany(findArgs)
    if (rows.length === 0) break

    for (const row of rows) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updates: Record<string, any> = {}
      let hasUpdate = false

      for (const field of config.fields) {
        const value = row[field]
        if (value === null || value === undefined) continue
        // Skip if already encrypted
        if (typeof value === "string" && looksEncrypted(value)) continue

        const encrypted = await encryptValue(value)
        if (encrypted !== null) {
          updates[field] = encrypted
          hasUpdate = true
        }
      }

      if (hasUpdate) {
        await config.delegate.update({
          where: { id: row.id },
          data: updates,
        })
      }
    }

    totalProcessed += rows.length
    cursor = rows[rows.length - 1].id
    process.stdout.write(`  Processed ${totalProcessed} rows...\r`)
  }

  console.log(`[${config.name}] Done. ${totalProcessed} rows processed.`)
}

async function main() {
  console.log("=== Encrypt Existing Data ===")
  console.log("Encryption key configured: ✓")

  initModels()

  for (const model of MODELS) {
    await migrateModel(model)
  }

  console.log("\n=== All models encrypted successfully ===")
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error("Migration failed:", e)
  await prisma.$disconnect()
  process.exit(1)
})
