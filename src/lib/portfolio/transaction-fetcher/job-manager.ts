/**
 * History sync job lifecycle: create, resume, and manage sync jobs.
 */

import { db } from "@/lib/db"
import type { Prisma } from "@/generated/prisma/client"
import { ZERION_MULTI_CHAIN } from "../zerion-transaction-fetcher"
import type { HistoryJobStatus } from "./types"

export async function startOrResumeHistorySyncJob(userId: string): Promise<{ jobId: string; status: HistoryJobStatus }> {
  const { ensureSyncStatesForUser } = await import("./sync-state")
  await ensureSyncStatesForUser(userId)

  const existing = await db.historySyncJob.findFirst({
    where: {
      userId,
      status: { in: ["queued", "running"] },
    },
    orderBy: { updatedAt: "desc" },
  })

  if (existing) {
    const staleThresholdMs = 10 * 60 * 1000
    const lastActivity = existing.lastRunAt ?? existing.startedAt ?? existing.createdAt
    if (lastActivity && Date.now() - lastActivity.getTime() > staleThresholdMs) {
      await db.historySyncJob.update({
        where: { id: existing.id },
        data: { status: "failed", error: "Stale job recovered", completedAt: new Date() },
      })
    } else {
      return { jobId: existing.id, status: existing.status as HistoryJobStatus }
    }
  }

  await db.transactionSyncState.updateMany({
    where: { userId, isComplete: false },
    data: { retryAfter: null },
  })

  await db.transactionSyncState.updateMany({
    where: {
      userId,
      isComplete: true,
      lastErrorCode: {
        not: null,
        notIn: [
          "alchemy_unauthorized",
          "alchemy_unsupported_method",
          "unsupported_chain",
          "helius_unauthorized",
          "helius_key_missing",
          "alchemy_key_missing",
          "explorer_key_missing",
        ],
      },
    },
    data: {
      isComplete: false,
      retryAfter: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      phase: "bootstrap",
    },
  })

  const zerionRetryCooloff = new Date(Date.now() - 6 * 60 * 60 * 1000)
  await db.transactionSyncState.updateMany({
    where: {
      userId,
      isComplete: true,
      chain: ZERION_MULTI_CHAIN,
      recordsInserted: 0,
      lastErrorCode: null,
      phase: "completed",
      updatedAt: { lt: zerionRetryCooloff },
    },
    data: {
      isComplete: false,
      phase: "bootstrap",
      requestsProcessed: 0,
      retryAfter: null,
    },
  })

  const created = await db.historySyncJob.create({
    data: {
      userId,
      status: "queued",
      strategy: "latest_first",
    },
  })

  return { jobId: created.id, status: "queued" }
}

export function buildCursorSnapshot(syncStates: Array<{
  walletAddress: string
  chain: string
  isComplete: boolean
  phase: string
  cursorFromBlock: number | null
  cursorToBlock: number | null
  pageKey: string | null
  retryAfter: Date | null
  lastErrorCode: string | null
  recordsInserted: number
}>): Prisma.InputJsonValue {
  return syncStates.map((s) => ({
    walletAddress: s.walletAddress,
    chain: s.chain,
    isComplete: s.isComplete,
    phase: s.phase,
    cursorFromBlock: s.cursorFromBlock,
    cursorToBlock: s.cursorToBlock,
    pageKey: s.pageKey,
    retryAfter: s.retryAfter?.toISOString() ?? null,
    lastErrorCode: s.lastErrorCode,
    recordsInserted: s.recordsInserted,
  })) as Prisma.InputJsonValue
}
