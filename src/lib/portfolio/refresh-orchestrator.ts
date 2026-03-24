import { createHash } from "node:crypto"
import { db } from "@/lib/db"
import { getAllExchangeCredentials } from "@/lib/portfolio/service-keys"
import { fetchAllExchangeBalances } from "@/lib/portfolio/exchange-client"
import { getCachedMultiProviderPositions } from "@/lib/portfolio/multi-balance-cache"
import { buildStakingResponse } from "@/app/api/portfolio/staking/route"
import { withProviderPermit, isProviderThrottleError } from "@/lib/portfolio/provider-governor"

type RefreshJobStatus = "queued" | "running" | "completed" | "failed"

const DEFAULT_REFRESH_TTL_MS = 5 * 60_000
const STALE_JOB_TIMEOUT_MS = 10 * 60_000 // 10 minutes — any "running" job older than this is stuck

function parseRefreshTtlMs(): number {
  const parsed = Number.parseInt(process.env.PORTFOLIO_REFRESH_TTL_MS ?? "", 10)
  return Number.isFinite(parsed) && parsed > 1_000 ? parsed : DEFAULT_REFRESH_TTL_MS
}

function walletFingerprint(addresses: string[]): string {
  const sorted = addresses.map((a) => a.toLowerCase()).sort().join("|")
  return createHash("sha256").update(sorted).digest("hex").slice(0, 16)
}

function normalizeDate(value: Date | null | undefined): Date | null {
  if (!value) return null
  return new Date(value)
}

export interface RefreshMeta {
  asOf: string | null
  freshnessMs: number | null
  stale: boolean
  nextEligibleRefreshAt: string | null
  refreshJob: { status: RefreshJobStatus; jobId: string } | null
}

export interface QueueRefreshResult {
  accepted: boolean
  queued: boolean
  skipped: boolean
  reason: "already_running" | "fresh_within_ttl" | "queued" | "forced"
  nextEligibleRefreshAt: string | null
  jobId: string | null
}

export async function getLatestPortfolioRefreshJob(userId: string) {
  return db.portfolioRefreshJob.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  })
}

export async function getLatestLiveSnapshotAt(userId: string): Promise<Date | null> {
  const latest = await db.portfolioSnapshot.findFirst({
    where: { userId, source: "live_refresh" },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  })
  return normalizeDate(latest?.createdAt ?? null)
}

export async function getRefreshMeta(userId: string, asOfHint?: Date | null): Promise<RefreshMeta> {
  const [latestSnapshotAt, latestJob] = await Promise.all([
    asOfHint ? Promise.resolve(asOfHint) : getLatestLiveSnapshotAt(userId),
    getLatestPortfolioRefreshJob(userId),
  ])

  // Auto-expire stuck "running" jobs that haven't been updated in 10 minutes.
  // This prevents the "Syncing" badge from showing permanently when a job
  // crashes or times out without updating its status.
  if (
    latestJob &&
    (latestJob.status === "running" || latestJob.status === "queued") &&
    Date.now() - latestJob.updatedAt.getTime() > STALE_JOB_TIMEOUT_MS
  ) {
    await db.portfolioRefreshJob.update({
      where: { id: latestJob.id },
      data: { status: "failed" },
    }).catch((err) => {
      console.warn("[refresh-orchestrator] Failed to mark job as failed:", err)
    })
    latestJob.status = "failed"
  }

  const asOf = normalizeDate(latestSnapshotAt)
  const now = Date.now()
  const ttlMs = parseRefreshTtlMs()
  const freshnessMs = asOf ? Math.max(0, now - asOf.getTime()) : null
  const stale = freshnessMs === null ? true : freshnessMs > ttlMs
  const nextEligible = asOf ? new Date(asOf.getTime() + ttlMs) : null

  return {
    asOf: asOf?.toISOString() ?? null,
    freshnessMs,
    stale,
    nextEligibleRefreshAt: nextEligible?.toISOString() ?? null,
    refreshJob: latestJob
      ? {
          status: latestJob.status as RefreshJobStatus,
          jobId: latestJob.id,
        }
      : null,
  }
}

export async function queuePortfolioRefresh(
  userId: string,
  opts?: { force?: boolean; reason?: string }
): Promise<QueueRefreshResult> {
  const force = opts?.force ?? false
  const ttlMs = parseRefreshTtlMs()
  const now = new Date()
  const [latestSnapshotAt, activeJob] = await Promise.all([
    getLatestLiveSnapshotAt(userId),
    db.portfolioRefreshJob.findFirst({
      where: { userId, status: { in: ["queued", "running"] } },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  if (activeJob) {
    return {
      accepted: true,
      queued: false,
      skipped: true,
      reason: "already_running",
      nextEligibleRefreshAt: latestSnapshotAt ? new Date(latestSnapshotAt.getTime() + ttlMs).toISOString() : null,
      jobId: activeJob.id,
    }
  }

  const isFresh = latestSnapshotAt ? (now.getTime() - latestSnapshotAt.getTime()) <= ttlMs : false
  const created = await db.portfolioRefreshJob.create({
    data: {
      userId,
      status: "queued",
      reason: opts?.reason ?? (force ? "forced" : (isFresh ? "manual_within_ttl" : "scheduled")),
      staleBefore: latestSnapshotAt ?? null,
    },
  })

  return {
    accepted: true,
    queued: true,
    skipped: false,
    reason: force ? "forced" : (isFresh ? "fresh_within_ttl" : "queued"),
    nextEligibleRefreshAt: latestSnapshotAt ? new Date(latestSnapshotAt.getTime() + ttlMs).toISOString() : null,
    jobId: created.id,
  }
}

interface RunRefreshResult {
  jobId: string
  status: RefreshJobStatus
  onchainTotal: number
  exchangeTotal: number
  totalValue: number
  asOfAfter: string | null
  warnings: string[]
}

export async function runPortfolioRefreshJob(jobId: string): Promise<RunRefreshResult> {
  const job = await db.portfolioRefreshJob.findUnique({
    where: { id: jobId },
    select: { id: true, userId: true, status: true },
  })

  if (!job) {
    throw new Error(`Refresh job not found: ${jobId}`)
  }

  if (job.status === "completed") {
    return {
      jobId: job.id,
      status: "completed",
      onchainTotal: 0,
      exchangeTotal: 0,
      totalValue: 0,
      asOfAfter: null,
      warnings: ["already_completed"],
    }
  }

  await db.portfolioRefreshJob.update({
    where: { id: job.id },
    data: { status: "running", startedAt: new Date() },
  })

  const warnings: string[] = []

  try {
    const [wallets, exchangeCreds] = await Promise.all([
      db.trackedWallet.findMany({
        where: { userId: job.userId },
        orderBy: { createdAt: "asc" },
        select: { address: true, chains: true },
      }),
      getAllExchangeCredentials(job.userId),
    ])

    const addresses = wallets.map((wallet) => wallet.address)
    const fp = walletFingerprint(addresses)

    let walletData: Awaited<ReturnType<typeof getCachedMultiProviderPositions>>["wallets"] | null = null
    if (addresses.length > 0) {
      try {
        const result = await getCachedMultiProviderPositions(
          job.userId,
          wallets.map((w) => ({ address: w.address, chains: w.chains })),
        )
        if (result.failedCount > 0) warnings.push(`balance_partial:${result.failedCount}`)
        walletData = result.wallets
      } catch (err) {
        warnings.push(isProviderThrottleError(err) ? "balance_rate_limited" : "balance_fetch_error")
        throw err
      }
    }

    let exchangeData: Awaited<ReturnType<typeof fetchAllExchangeBalances>> | null = null
    if (exchangeCreds.length > 0) {
      const exchangeOp = `balances:${exchangeCreds.map((cred) => cred.exchangeId).sort((a, b) => a.localeCompare(b)).join("|")}`
      exchangeData = await withProviderPermit(
        job.userId,
        "ccxt",
        exchangeOp,
        undefined,
        () => fetchAllExchangeBalances(exchangeCreds, job.userId)
      )
    }

    try {
      await buildStakingResponse(job.userId)
      // Cache is now warm — do NOT invalidate here
    } catch (error) {
      if (isProviderThrottleError(error)) {
        warnings.push(`staking_throttled_until:${error.nextAllowedAt?.toISOString() ?? "unknown"}`)
      } else {
        warnings.push(`staking_refresh_failed:${error instanceof Error ? error.message : "unknown"}`)
      }
    }

    const onchainTotal = walletData ? walletData.reduce((sum, wallet) => sum + wallet.totalValue, 0) : 0
    const exchangeTotal = exchangeData?.totalValue ?? 0
    const totalValue = onchainTotal + exchangeTotal
    const now = new Date()

    const allWalletsReturned = walletData != null && walletData.length === wallets.length
    const exchangeIncluded = exchangeCreds.length === 0 || (
      exchangeData != null
      && exchangeData.exchanges.length === exchangeCreds.length
      && exchangeData.exchanges.every((exchange) => !exchange.error)
    )
    const addressesLower = addresses.map((address) => address.toLowerCase()).sort((a, b) => a.localeCompare(b))

    const snapshotQuality = allWalletsReturned && exchangeIncluded ? "complete" : "partial"
    if (totalValue > 0 && allWalletsReturned) {
      // Create snapshot even if exchange data is partial
      const chainDistribution: Record<string, number> = {}
      for (const wallet of walletData ?? []) {
        for (const position of wallet.positions) {
          chainDistribution[position.chain] = (chainDistribution[position.chain] || 0) + position.value
        }
      }
      if (exchangeTotal > 0) {
        chainDistribution.exchange = exchangeTotal
      }

      await db.portfolioSnapshot.create({
        data: {
          userId: job.userId,
          totalValue,
          walletCount: wallets.length,
          source: "live_refresh",
          metadata: JSON.stringify({
            chainDistribution,
            walletAddresses: addressesLower,
            walletFingerprint: fp,
            onchainTotalValue: onchainTotal,
            exchangeTotalValue: exchangeTotal,
            snapshotQuality,
            exchangePartial: !exchangeIncluded,
          }),
        },
      })

      // Clear chartWipedAt flag so chart rebuilds from Zerion on next load
      await db.$executeRaw`
        UPDATE "PortfolioSetting"
        SET settings = settings - 'chartWipedAt'
        WHERE "userId" = ${job.userId}
          AND settings ? 'chartWipedAt'
      `

      if (!exchangeIncluded && exchangeCreds.length > 0) {
        warnings.push("snapshot_exchange_partial")
      }
    } else {
      warnings.push("snapshot_skipped_incomplete_fetch")
    }

    await db.portfolioRefreshJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        completedAt: now,
        asOfAfter: now,
        details: {
          onchainTotal,
          exchangeTotal,
          totalValue,
          walletCount: wallets.length,
          exchangeCount: exchangeCreds.length,
          warnings,
        },
        error: null,
      },
    })

    return {
      jobId: job.id,
      status: "completed",
      onchainTotal,
      exchangeTotal,
      totalValue,
      asOfAfter: now.toISOString(),
      warnings,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown refresh failure"
    await db.portfolioRefreshJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        completedAt: new Date(),
        error: message,
        details: { warnings },
      },
    })
    throw error
  }
}

export async function runNextPortfolioRefreshJobs(limit = 10): Promise<{
  processed: number
  totalQueued: number
  results: Array<RunRefreshResult | { jobId: string; status: "failed"; error: string }>
}> {
  const jobs = await db.portfolioRefreshJob.findMany({
    where: { status: { in: ["queued", "running"] } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(100, limit)),
    select: { id: true },
  })

  const results: Array<RunRefreshResult | { jobId: string; status: "failed"; error: string }> = []
  for (const job of jobs) {
    try {
      const run = await runPortfolioRefreshJob(job.id)
      results.push(run)
    } catch (error) {
      results.push({
        jobId: job.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown refresh error",
      })
    }
  }

  const remainingCount = await db.portfolioRefreshJob.count({
    where: { status: { in: ["queued", "running"] } },
  })

  return {
    processed: jobs.length,
    totalQueued: remainingCount,
    results,
  }
}
