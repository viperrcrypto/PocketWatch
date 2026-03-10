/**
 * Provider rate-limiting governor with per-key permits and usage tracking.
 *
 * Re-exports types for backward compatibility.
 */

import { randomUUID } from "node:crypto"
import { db } from "@/lib/db"

// Re-export everything from types for backward compatibility
export {
  type ProviderName,
  type PermitDenyReason,
  type AcquirePermitOptions,
  type ProviderPermit,
  type ProviderCallResult,
  ProviderThrottleError,
  isProviderThrottleError,
  getProviderMinIntervalMs,
  getProviderKeyGlobalIntervalMs,
  computeNextAllowedAt,
  getMinuteBucket,
  statusFromUnknown,
  errorCodeFromUnknown,
  DEFAULT_LEASE_MS,
} from "./provider-governor-types"

import type {
  ProviderName,
  PermitDenyReason,
  AcquirePermitOptions,
  ProviderPermit,
  ProviderCallResult,
} from "./provider-governor-types"

import {
  ProviderThrottleError,
  getProviderMinIntervalMs,
  getProviderKeyGlobalIntervalMs,
  computeNextAllowedAt,
  getMinuteBucket,
  statusFromUnknown,
  errorCodeFromUnknown,
  DEFAULT_LEASE_MS,
} from "./provider-governor-types"

export async function acquirePermit(
  userId: string,
  provider: ProviderName,
  operationKey: string,
  opts?: AcquirePermitOptions,
  serviceKeyId?: string
): Promise<ProviderPermit> {
  const keyId = serviceKeyId ?? "shared"
  const owner = randomUUID()
  const now = new Date()
  const minIntervalMs = Math.max(50, opts?.minIntervalMs ?? getProviderMinIntervalMs(provider))
  const leaseMs = Math.max(1_000, opts?.leaseMs ?? DEFAULT_LEASE_MS)
  const leaseUntil = new Date(now.getTime() + leaseMs)

  let gate = await db.providerCallGate.upsert({
    where: {
      userId_provider_operationKey_serviceKeyId: { userId, provider, operationKey, serviceKeyId: keyId },
    },
    create: {
      userId, provider, operationKey, serviceKeyId: keyId,
      leaseOwner: null, leaseUntil: null, nextAllowedAt: null, consecutive429: 0,
    },
    update: {},
  })

  if (gate.leaseOwner && gate.leaseUntil && gate.leaseUntil.getTime() > now.getTime() && gate.leaseOwner !== owner) {
    return {
      acquired: false, provider, operationKey, userId, gateId: gate.id,
      leaseOwner: owner, leaseUntil, nextAllowedAt: gate.leaseUntil,
      minIntervalMs, denyReason: "leased",
    }
  }

  if (gate.consecutive429 > 0 && (!gate.nextAllowedAt || gate.nextAllowedAt.getTime() <= now.getTime())) {
    await db.providerCallGate.update({ where: { id: gate.id }, data: { consecutive429: 0 } })
    gate = { ...gate, consecutive429: 0 }
  }

  if (gate.nextAllowedAt && gate.nextAllowedAt.getTime() > now.getTime()) {
    const waitSec = Math.ceil((gate.nextAllowedAt.getTime() - now.getTime()) / 1000)
    console.log(`[governor] THROTTLED ${provider}:${operationKey} key=${serviceKeyId?.slice(0, 8) ?? "shared"} waitSec=${waitSec} consecutive429=${gate.consecutive429}`)
    return {
      acquired: false, provider, operationKey, userId, gateId: gate.id,
      leaseOwner: owner, leaseUntil, nextAllowedAt: gate.nextAllowedAt,
      minIntervalMs, denyReason: "throttled",
    }
  }

  const updated = await db.providerCallGate.updateMany({
    where: {
      id: gate.id,
      AND: [
        { OR: [{ leaseOwner: null }, { leaseUntil: null }, { leaseUntil: { lte: now } }, { leaseOwner: gate.leaseOwner ?? "" }] },
        { OR: [{ nextAllowedAt: null }, { nextAllowedAt: { lte: now } }] },
      ],
    },
    data: { leaseOwner: owner, leaseUntil },
  })

  if (updated.count === 0) {
    const latest = await db.providerCallGate.findUnique({
      where: { id: gate.id },
      select: { nextAllowedAt: true, leaseUntil: true },
    })
    const denyReason: PermitDenyReason = latest?.leaseUntil && latest.leaseUntil.getTime() > now.getTime()
      ? "leased" : "throttled"
    return {
      acquired: false, provider, operationKey, userId, gateId: gate.id,
      leaseOwner: owner, leaseUntil, nextAllowedAt: latest?.nextAllowedAt ?? latest?.leaseUntil ?? null,
      minIntervalMs, denyReason,
    }
  }

  return {
    acquired: true, provider, operationKey, userId, gateId: gate.id,
    leaseOwner: owner, leaseUntil, nextAllowedAt: gate.nextAllowedAt, minIntervalMs,
  }
}

export async function recordProviderResult(permit: ProviderPermit, result: ProviderCallResult): Promise<void> {
  if (!permit.acquired) return

  const now = new Date()
  await db.$transaction(async (tx) => {
    const current = await tx.providerCallGate.findUnique({
      where: { id: permit.gateId },
      select: { consecutive429: true, leaseOwner: true },
    })
    if (!current) return

    const statusCode = typeof result.statusCode === "number" ? result.statusCode : null
    const nextConsecutive429 = statusCode === 429 ? current.consecutive429 + 1 : 0
    const nextAllowedAt = computeNextAllowedAt(now, permit.minIntervalMs, statusCode, nextConsecutive429)

    await tx.providerCallGate.update({
      where: { id: permit.gateId },
      data: {
        leaseOwner: null, leaseUntil: now, nextAllowedAt,
        consecutive429: nextConsecutive429, lastStatusCode: statusCode,
        lastErrorCode: result.errorCode ?? null,
      },
    })

    const minuteBucket = getMinuteBucket(now)
    const successCount = statusCode && statusCode >= 200 && statusCode < 300 ? 1 : 0
    const rateLimitedCount = statusCode === 429 ? 1 : 0
    const errorCount = successCount === 0 ? 1 : 0

    await tx.providerUsageMinute.upsert({
      where: { provider_minuteBucket: { provider: permit.provider, minuteBucket } },
      create: { provider: permit.provider, minuteBucket, callCount: 1, successCount, rateLimitedCount, errorCount },
      update: {
        callCount: { increment: 1 }, successCount: { increment: successCount },
        rateLimitedCount: { increment: rateLimitedCount }, errorCount: { increment: errorCount },
      },
    })
  })
}

export async function withProviderPermit<T>(
  userId: string,
  provider: ProviderName,
  operationKey: string,
  opts: AcquirePermitOptions | undefined,
  work: () => Promise<T>,
  serviceKeyId?: string
): Promise<T> {
  const permit = await acquirePermit(userId, provider, operationKey, opts, serviceKeyId)
  if (!permit.acquired) {
    throw new ProviderThrottleError(provider, operationKey, permit.denyReason ?? "throttled", permit.nextAllowedAt)
  }

  try {
    const value = await work()
    await recordProviderResult(permit, { statusCode: 200 })
    return value
  } catch (error) {
    await recordProviderResult(permit, { statusCode: statusFromUnknown(error), errorCode: errorCodeFromUnknown(error) })
    throw error
  }
}

/**
 * Try multiple keys in order until one acquires a permit and succeeds.
 */
export async function withProviderPermitRotating<T>(
  userId: string,
  provider: ProviderName,
  operationKey: string,
  opts: AcquirePermitOptions | undefined,
  keys: Array<{ id: string; key: string; label: string | null; consecutive429: number; lastUsedAt: Date | null; verified: boolean }>,
  workFn: (key: { id: string; key: string; label: string | null }) => Promise<T>,
  onKeyThrottled?: (keyId: string) => void,
  onKeySuccess?: (keyId: string) => void
): Promise<T> {
  if (keys.length === 0) {
    throw new ProviderThrottleError(provider, operationKey, "throttled", null)
  }

  let earliestNextAllowed: Date | null = null
  const globalIntervalMs = getProviderKeyGlobalIntervalMs(provider)

  for (const key of keys) {
    const globalPermit = await acquirePermit(userId, provider, "_global", { minIntervalMs: globalIntervalMs }, key.id)
    if (!globalPermit.acquired) {
      if (globalPermit.nextAllowedAt) {
        if (!earliestNextAllowed || globalPermit.nextAllowedAt.getTime() < earliestNextAllowed.getTime()) {
          earliestNextAllowed = globalPermit.nextAllowedAt
        }
      }
      continue
    }

    const permit = await acquirePermit(userId, provider, operationKey, opts, key.id)
    if (!permit.acquired) {
      await db.providerCallGate.update({
        where: { id: globalPermit.gateId },
        data: { leaseOwner: null, leaseUntil: new Date(), nextAllowedAt: null },
      })
      if (permit.nextAllowedAt) {
        if (!earliestNextAllowed || permit.nextAllowedAt.getTime() < earliestNextAllowed.getTime()) {
          earliestNextAllowed = permit.nextAllowedAt
        }
      }
      continue
    }

    try {
      const value = await workFn(key)
      await recordProviderResult(permit, { statusCode: 200 })
      await recordProviderResult(globalPermit, { statusCode: 200 })
      onKeySuccess?.(key.id)
      return value
    } catch (error) {
      const status = statusFromUnknown(error)
      await recordProviderResult(permit, { statusCode: status, errorCode: errorCodeFromUnknown(error) })
      await recordProviderResult(globalPermit, { statusCode: 200 })

      if (status === 429) {
        onKeyThrottled?.(key.id)
        continue
      }
      throw error
    }
  }

  const waitSec = earliestNextAllowed ? Math.ceil((earliestNextAllowed.getTime() - Date.now()) / 1000) : null
  console.log(`[governor] ALL KEYS EXHAUSTED ${provider}:${operationKey} keys=${keys.length} nextAllowed=${waitSec != null ? waitSec + "s" : "unknown"}`)
  throw new ProviderThrottleError(provider, operationKey, "throttled", earliestNextAllowed)
}

export async function getProviderBudgetState(
  userId: string,
  provider: ProviderName
): Promise<{
  provider: ProviderName
  operationCount: number
  activeLeases: number
  nextAllowedAt: string | null
}> {
  const now = new Date()
  const gates = await db.providerCallGate.findMany({
    where: { userId, provider, NOT: { operationKey: "_global" } },
    select: { leaseUntil: true, nextAllowedAt: true },
  })

  const activeLeases = gates.filter((gate) => gate.leaseUntil && gate.leaseUntil.getTime() > now.getTime()).length
  const future = gates
    .map((gate) => gate.nextAllowedAt)
    .filter((date): date is Date => Boolean(date && date.getTime() > now.getTime()))
    .sort((a, b) => a.getTime() - b.getTime())

  return {
    provider,
    operationCount: gates.length,
    activeLeases,
    nextAllowedAt: future[0]?.toISOString() ?? null,
  }
}
