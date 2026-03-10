/**
 * Provider governor types, configuration, and utility functions.
 */

export type ProviderName = "zerion" | "alchemy" | "ccxt" | "defillama" | "helius" | "etherscan"
export type PermitDenyReason = "leased" | "throttled"

export interface AcquirePermitOptions {
  minIntervalMs?: number
  leaseMs?: number
}

export interface ProviderPermit {
  acquired: boolean
  provider: ProviderName
  operationKey: string
  userId: string
  gateId: string
  leaseOwner: string
  leaseUntil: Date
  nextAllowedAt: Date | null
  minIntervalMs: number
  denyReason?: PermitDenyReason
}

export interface ProviderCallResult {
  statusCode?: number | null
  errorCode?: string | null
}

export const DEFAULT_LEASE_MS = 30_000

export const DEFAULT_MIN_INTERVAL_MS: Record<ProviderName, number> = {
  zerion: 2_000,
  alchemy: 500,
  ccxt: 15_000,
  defillama: 1_000,
  helius: 200,
  etherscan: 250,
}

// Global per-key interval: minimum ms between ANY calls on the same API key.
export const DEFAULT_KEY_GLOBAL_INTERVAL_MS: Record<ProviderName, number> = {
  zerion: 2_000,
  alchemy: 1_000,
  ccxt: 15_000,
  defillama: 2_000,
  helius: 500,
  etherscan: 500,
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export function getProviderMinIntervalMs(provider: ProviderName): number {
  switch (provider) {
    case "zerion":
      return parsePositiveInt(process.env.ZERION_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS.zerion)
    case "alchemy":
      return parsePositiveInt(process.env.ALCHEMY_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS.alchemy)
    case "ccxt":
      return parsePositiveInt(process.env.CCXT_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS.ccxt)
    case "defillama":
      return parsePositiveInt(process.env.DEFI_LLAMA_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS.defillama)
    case "helius":
      return parsePositiveInt(process.env.HELIUS_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS.helius)
    case "etherscan":
      return parsePositiveInt(process.env.ETHERSCAN_MIN_INTERVAL_MS, DEFAULT_MIN_INTERVAL_MS.etherscan)
    default:
      return 1_000
  }
}

export function getProviderKeyGlobalIntervalMs(provider: ProviderName): number {
  return DEFAULT_KEY_GLOBAL_INTERVAL_MS[provider] ?? 1_000
}

export function getProviderBackoffBaseMs(): number {
  return parsePositiveInt(process.env.PROVIDER_429_BACKOFF_BASE_MS, 5_000)
}

export function getProviderBackoffMaxMs(): number {
  return parsePositiveInt(process.env.PROVIDER_429_BACKOFF_MAX_MS, 120_000)
}

export function getMinuteBucket(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 60_000) * 60_000)
}

export function statusFromUnknown(error: unknown): number | null {
  if (!error || typeof error !== "object") return null
  const maybeStatus = (error as Record<string, unknown>).status
  if (typeof maybeStatus === "number" && Number.isFinite(maybeStatus)) return maybeStatus

  const maybeStatusCode = (error as Record<string, unknown>).statusCode
  if (typeof maybeStatusCode === "number" && Number.isFinite(maybeStatusCode)) return maybeStatusCode

  const message = error instanceof Error ? error.message : String(error)
  if (message.includes("429")) return 429
  if (message.includes("401")) return 401
  if (message.includes("403")) return 403
  return null
}

export function errorCodeFromUnknown(error: unknown): string | null {
  if (!error || typeof error !== "object") return null
  const maybeCode = (error as Record<string, unknown>).code
  if (typeof maybeCode === "string" && maybeCode.trim()) return maybeCode
  return null
}

export function jitterMs(base: number): number {
  if (base <= 0) return 0
  const spread = Math.max(100, Math.floor(base * 0.2))
  return Math.floor(Math.random() * spread)
}

export function computeNextAllowedAt(
  now: Date,
  minIntervalMs: number,
  statusCode: number | null,
  consecutive429: number
): Date {
  if (statusCode === 429) {
    const base = getProviderBackoffBaseMs()
    const max = getProviderBackoffMaxMs()
    const power = Math.max(0, consecutive429 - 1)
    const backoff = Math.min(max, base * Math.pow(2, power))
    return new Date(now.getTime() + backoff + jitterMs(backoff))
  }

  if (typeof statusCode === "number" && statusCode >= 500) {
    const ms = Math.max(minIntervalMs, 5_000 + jitterMs(2_000))
    return new Date(now.getTime() + ms)
  }

  return new Date(now.getTime() + minIntervalMs)
}

export class ProviderThrottleError extends Error {
  provider: ProviderName
  operationKey: string
  nextAllowedAt: Date | null
  reason: PermitDenyReason

  constructor(provider: ProviderName, operationKey: string, reason: PermitDenyReason, nextAllowedAt: Date | null) {
    const next = nextAllowedAt ? ` until ${nextAllowedAt.toISOString()}` : ""
    super(`[provider-governor] ${provider}:${operationKey} blocked (${reason})${next}`)
    this.name = "ProviderThrottleError"
    this.provider = provider
    this.operationKey = operationKey
    this.nextAllowedAt = nextAllowedAt
    this.reason = reason
  }
}

export function isProviderThrottleError(error: unknown): error is ProviderThrottleError {
  return error instanceof ProviderThrottleError
}
