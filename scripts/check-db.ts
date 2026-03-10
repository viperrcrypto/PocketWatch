import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const [states, keys, job, txCount, sample] = await Promise.all([
    db.transactionSyncState.findMany({
      select: { walletAddress: true, chain: true, phase: true, isComplete: true, requestsProcessed: true, retryAfter: true, lastErrorCode: true },
    }),
    db.externalApiKey.findMany({
      select: { serviceName: true, label: true, verified: true, consecutive429: true },
    }),
    db.historySyncJob.findFirst({
      where: { status: { in: ["queued", "running"] } },
      orderBy: { updatedAt: "desc" },
    }),
    db.transactionCache.count(),
    db.transactionCache.findMany({ take: 3, orderBy: { blockTimestamp: "desc" }, select: { txHash: true, chain: true, symbol: true, usdValue: true, blockTimestamp: true, direction: true } }),
  ])

  console.log("=== Active Job ===")
  console.log(job ? `  id=${job.id.slice(0, 8)} status=${job.status}` : "  none")

  console.log("\n=== TransactionSyncState ===")
  if (states.length === 0) {
    console.log("  (empty — sync states not created yet)")
  } else {
    for (const s of states) {
      const retrySec = s.retryAfter ? Math.ceil((s.retryAfter.getTime() - Date.now()) / 1000) : null
      const retry = retrySec && retrySec > 0 ? ` retry=${retrySec}s` : ""
      console.log(`  ${s.walletAddress.slice(0, 10)}… ${s.chain.padEnd(14)} phase=${String(s.phase).padEnd(12)} complete=${String(s.isComplete).padEnd(5)} reqs=${s.requestsProcessed}${s.lastErrorCode ? ` err=${s.lastErrorCode}` : ""}${retry}`)
    }
  }

  console.log("\n=== ExternalApiKey ===")
  if (keys.length === 0) {
    console.log("  (empty)")
  } else {
    for (const k of keys) {
      const flag = !k.verified ? " ⚠️  NOT VERIFIED" : k.consecutive429 > 5 ? ` ⚠️  ${k.consecutive429}× throttled` : " ✓"
      console.log(`  ${k.serviceName.padEnd(10)} "${k.label ?? "unnamed"}"${flag}`)
    }
  }

  console.log("\n=== TransactionCache ===")
  console.log(`  Total records: ${txCount}`)
  if (sample.length > 0) {
    console.log("  Latest 3:")
    for (const t of sample) {
      const ts = t.blockTimestamp ? new Date(Number(t.blockTimestamp) * 1000).toISOString().slice(0, 10) : "?"
      console.log(`    ${ts} ${t.direction} ${t.symbol ?? "?"} $${t.usdValue?.toFixed(2) ?? "?"} [${t.chain}] ${t.txHash.slice(0, 12)}…`)
    }
  } else {
    console.log("  ⚠️  No transactions — history page will be empty")
  }

  const zerionVerified = keys.filter((k) => k.serviceName === "zerion" && k.verified).length
  const zerionMultiState = states.find((s) => s.chain === "ZERION_MULTI")

  console.log("\n=== Diagnosis ===")
  if (zerionVerified === 0) {
    console.log("  ⚠️  No verified Zerion keys → Alchemy fallback (slow)")
  } else if (!zerionMultiState) {
    console.log("  ⚠️  ZERION_MULTI missing → Settings → Reset Throttle")
  } else if (!zerionMultiState.isComplete) {
    const sec = zerionMultiState.retryAfter ? Math.ceil((zerionMultiState.retryAfter.getTime() - Date.now()) / 1000) : 0
    console.log(`  ⏳ Sync in progress${sec > 0 ? ` (blocked ${sec}s)` : ""}`)
  } else if (txCount === 0) {
    console.log("  ⚠️  Sync complete but 0 transactions — Zerion returned empty (retry or check wallet address)")
  } else {
    console.log(`  ✓  Sync complete with ${txCount} transactions`)
  }
}

main().finally(() => db.$disconnect())
