import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import {
  getLatestHistorySyncJob,
  getSyncProgress,
  runHistorySyncWorker,
  startOrResumeHistorySyncJob,
  isIncrementalSyncStale,
  scheduleIncrementalSync,
} from "@/lib/portfolio/transaction-fetcher"
import { ZERION_MULTI_CHAIN } from "@/lib/portfolio/zerion-transaction-fetcher"
import { reconstructPortfolioHistory } from "@/lib/portfolio/value-reconstructor"
import { invalidateStakingResponseCache } from "@/app/api/portfolio/staking/route"
import { getProviderBudgetState } from "@/lib/portfolio/provider-governor"
import { getKeyHealthSummary } from "@/lib/portfolio/service-keys"

type SyncProgressRow = Awaited<ReturnType<typeof getSyncProgress>>[number]

const PHASE_ORDER: Record<string, number> = {
  bootstrap: 0,
  "from:external": 1, "to:external": 2,
  "from:erc20": 3, "to:erc20": 4,
  "from:erc721": 5, "to:erc721": 6,
  "from:internal": 7, "to:internal": 8,
  // Etherscan-family phases (4 actions, mapped to same 0-8 range)
  "etherscan:txlist": 2,
  "etherscan:tokentx": 4,
  "etherscan:tokennfttx": 6,
  "etherscan:txlistinternal": 8,
  // Zerion single-phase (fetching = in progress, weight as 4/8)
  fetching: 4,
  // Solana two-phase: main address fetch (4/8), then ATA fetch (6/8)
  "fetching-atas": 6,
}
const TOTAL_PHASES = 8

function computeProgressPct(progress: SyncProgressRow[]): number {
  if (progress.length === 0) return 0
  let completedPhaseWork = 0
  const totalPhaseWork = progress.length * TOTAL_PHASES
  for (const p of progress) {
    if (p.isComplete) {
      completedPhaseWork += TOTAL_PHASES
    } else if (p.chain === ZERION_MULTI_CHAIN) {
      // Zerion: either fetching (50%) or done
      completedPhaseWork += p.phase === "fetching" ? 4 : 0
    } else {
      completedPhaseWork += PHASE_ORDER[p.phase] ?? 0
    }
  }
  return totalPhaseWork > 0 ? Math.round((completedPhaseWork / totalPhaseWork) * 100) : 0
}

function summarizeFailures(progress: SyncProgressRow[]) {
  return progress
    .filter((p) => p.lastErrorCode && p.phase !== "skipped" && p.phase !== "needs_key")
    .map((p) => ({
      walletAddress: p.walletAddress,
      chain: p.chain,
      code: p.lastErrorCode,
      message: p.lastErrorMessage,
      retryAfter: p.retryAfter?.toISOString() ?? null,
    }))
}

function computeNextAdvanceAt(
  progress: SyncProgressRow[],
  zerionBudget: { nextAllowedAt?: string | Date | null },
  alchemyBudget: { nextAllowedAt?: string | Date | null },
  heliusBudget: { nextAllowedAt?: string | Date | null },
): string | null {
  const now = Date.now()
  const blocked = progress
    .filter((row) => !row.isComplete && row.retryAfter && row.retryAfter.getTime() > now)
    .map((row) => row.retryAfter as Date)
    .sort((a, b) => a.getTime() - b.getTime())

  // Only include Alchemy/Helius provider throttle times if there are actually
  // incomplete non-Zerion states — prevents "Rate limited by Alchemy" showing
  // when only ZERION_MULTI sync is active.
  const hasActiveAlchemyStates = progress.some(
    (row) => !row.isComplete && row.chain !== ZERION_MULTI_CHAIN
  )

  const toDate = (v: string | Date | null | undefined): Date | null => {
    if (!v) return null
    return v instanceof Date ? v : new Date(v)
  }

  const candidates: (Date | null)[] = [
    blocked[0] ?? null,
    toDate(zerionBudget.nextAllowedAt),
    ...(hasActiveAlchemyStates
      ? [toDate(alchemyBudget.nextAllowedAt), toDate(heliusBudget.nextAllowedAt)]
      : []),
  ]

  const earliest = candidates
    .filter((d): d is Date => d != null && d.getTime() > now)
    .sort((a, b) => a.getTime() - b.getTime())[0]

  return earliest?.toISOString() ?? null
}

async function maybeRunReconstruction(userId: string, shouldRun: boolean) {
  if (!shouldRun) return null

  const reconstructed = await reconstructPortfolioHistory(userId)
  invalidateStakingResponseCache(userId)
  return reconstructed
}

/**
 * POST /api/portfolio/history/sync
 * Start/resume latest-first async sync and execute a bounded worker slice.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  const doReconstruct = req.nextUrl.searchParams.get("reconstruct") !== "false"

  try {
    // If all syncs are already complete, schedule an incremental sync to pick up
    // new transactions since the last high-water mark. This makes "Process Events"
    // always fetch the latest data instead of reporting "no new transactions."
    const preProgress = await getSyncProgress(user.id)
    const allComplete = preProgress.length > 0 && preProgress.every((p) => p.isComplete)
    if (allComplete) {
      await scheduleIncrementalSync(user.id)
    }

    const started = await startOrResumeHistorySyncJob(user.id)

    const run = await runHistorySyncWorker(user.id, {
      maxSyncsPerRun: 6,
      maxRequestsPerSync: 8,
      maxMsPerSync: 7_000,
    })

    const [job, progress, alchemyBudget, heliusBudget, zerionBudget] = await Promise.all([
      getLatestHistorySyncJob(user.id),
      getSyncProgress(user.id),
      getProviderBudgetState(user.id, "alchemy"),
      getProviderBudgetState(user.id, "helius"),
      getProviderBudgetState(user.id, "zerion"),
    ])

    const status = run?.status ?? started.status
    const totalSyncs = run?.totalSyncs ?? progress.length
    const processedSyncs = run?.processedSyncs ?? progress.filter((p) => p.isComplete).length
    const failedSyncs = run?.failedSyncs ?? progress.filter((p) => p.isComplete && !!p.lastErrorCode && p.phase !== "skipped" && p.phase !== "needs_key").length
    const failedDetails = summarizeFailures(progress)
    const missingKeys = progress.filter((p) => p.phase === "needs_key").map((p) => ({
      walletAddress: p.walletAddress,
      chain: p.chain,
      message: p.lastErrorMessage,
    }))
    const progressPct = computeProgressPct(progress)
    const nextAdvanceAt = computeNextAdvanceAt(progress, zerionBudget, alchemyBudget, heliusBudget)
    const throttled = Boolean(nextAdvanceAt && processedSyncs < totalSyncs)

    if (status === "failed") {
      return NextResponse.json({
        success: false,
        error: "sync_failed",
        message: "History sync failed for all chains. Check API keys and retry.",
        jobId: started.jobId,
        status,
        totalSyncs,
        processedSyncs,
        progressPct,
        failedSyncs,
        failedDetails,
        progress,
        job,
      }, { status: 422 })
    }

    const reconstructionQueued = doReconstruct && (status === "completed" || status === "partial")
    if (reconstructionQueued) {
      void maybeRunReconstruction(user.id, true).catch((err) =>
        console.error("[sync-route] background reconstruction failed:", err)
      )
    }

    return NextResponse.json({
      success: true,
      jobId: started.jobId,
      status,
      running: status === "queued" || status === "running",
      completed: status === "completed" || status === "partial",
      totalSyncs,
      processedSyncs,
      progressPct,
      failedSyncs,
      totalNewTransactions: run?.insertedTxCount ?? progress.reduce((sum, p) => sum + (p.recordsInserted ?? 0), 0),
      details: run?.results ?? [],
      failedDetails,
      missingKeys,
      reconstructionQueued,
      job,
      progress,
      throttled,
      nextAdvanceAt,
      budgetState: {
        zerion: zerionBudget,
        alchemy: alchemyBudget,
        helius: heliusBudget,
      },
      warnings: status === "partial"
        ? ["Sync completed with partial failures. Some wallet/chain pairs could not be fully synced."]
        : [],
    })
  } catch (error) {
    return apiError("E9094", "Transaction sync failed", 500, error)
  }
}

/**
 * GET /api/portfolio/history/sync
 * Returns async job + progress. If `advance=1`, executes one bounded worker slice.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9090", "Authentication required", 401)

  const shouldAdvance = req.nextUrl.searchParams.get("advance") === "1"
  const doReconstruct = req.nextUrl.searchParams.get("reconstruct") === "1"
  const autoStart = req.nextUrl.searchParams.get("autoStart") === "1"

  try {
    let advanced = null as Awaited<ReturnType<typeof runHistorySyncWorker>>
    let autoStarted: { jobId: string; status: string } | null = null

    if (shouldAdvance) {
      const activeJob = await getLatestHistorySyncJob(user.id)
      let runnableJob = activeJob

      if (
        autoStart &&
        (!runnableJob || (runnableJob.status !== "queued" && runnableJob.status !== "running"))
      ) {
        const currentProgress = await getSyncProgress(user.id)
        const hasIncompleteSyncs = currentProgress.some((row) => !row.isComplete)
        if (hasIncompleteSyncs || currentProgress.length === 0) {
          const started = await startOrResumeHistorySyncJob(user.id)
          autoStarted = started
          const refreshedJob = await getLatestHistorySyncJob(user.id)
          if (refreshedJob && (refreshedJob.status === "queued" || refreshedJob.status === "running")) {
            runnableJob = refreshedJob
          }
        }
      }

      if (runnableJob && (runnableJob.status === "queued" || runnableJob.status === "running")) {
        advanced = await runHistorySyncWorker(user.id, {
          maxSyncsPerRun: 4,
          maxRequestsPerSync: 6,
          maxMsPerSync: 5_000,
        })

        if (doReconstruct && advanced && (advanced.status === "completed" || advanced.status === "partial")) {
          await maybeRunReconstruction(user.id, true)
        }
      }

      // Auto-schedule incremental sync if no active job and data is stale
      const refreshedJob = await getLatestHistorySyncJob(user.id)
      const noActiveJob = !refreshedJob || (refreshedJob.status !== "queued" && refreshedJob.status !== "running")
      if (noActiveJob) {
        const stale = await isIncrementalSyncStale(user.id)
        if (stale) await scheduleIncrementalSync(user.id)
      }
    }

    const [job, progress, alchemyBudget, heliusBudget, zerionBudget, keyHealth] = await Promise.all([
      getLatestHistorySyncJob(user.id),
      getSyncProgress(user.id),
      getProviderBudgetState(user.id, "alchemy"),
      getProviderBudgetState(user.id, "helius"),
      getProviderBudgetState(user.id, "zerion"),
      getKeyHealthSummary(user.id),
    ])

    const totalSyncs = progress.length
    const processedSyncs = progress.filter((p) => p.isComplete).length
    const failedSyncs = progress.filter((p) => p.isComplete && !!p.lastErrorCode && p.phase !== "skipped" && p.phase !== "needs_key").length
    const progressPct = computeProgressPct(progress)
    const failedDetails = summarizeFailures(progress)
    const missingKeys = progress.filter((p) => p.phase === "needs_key").map((p) => ({
      walletAddress: p.walletAddress,
      chain: p.chain,
      message: p.lastErrorMessage,
    }))
    const nextAdvanceAt = computeNextAdvanceAt(progress, zerionBudget, alchemyBudget, heliusBudget)
    const throttled = Boolean(nextAdvanceAt && processedSyncs < totalSyncs)

    return NextResponse.json({
      success: true,
      job,
      progress,
      totalSyncs,
      processedSyncs,
      progressPct,
      failedSyncs,
      failedDetails,
      missingKeys,
      allComplete: totalSyncs > 0 && processedSyncs === totalSyncs,
      throttled,
      nextAdvanceAt,
      budgetState: {
        zerion: zerionBudget,
        alchemy: alchemyBudget,
        helius: heliusBudget,
      },
      keyHealth,
      autoStarted,
      advanced: advanced
        ? {
            status: advanced.status,
            processedSyncs: advanced.processedSyncs,
            failedSyncs: advanced.failedSyncs,
            insertedTxCount: advanced.insertedTxCount,
          }
        : null,
    })
  } catch (error) {
    return apiError("E9095", "Failed to retrieve sync progress", 500, error)
  }
}
