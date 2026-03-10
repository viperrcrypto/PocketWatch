/**
 * Helper utilities for the transaction fetcher: phase management, error
 * classification, block fetching, and value derivation.
 */

import { isProviderThrottleError, withProviderPermitRotating } from "../provider-governor"
import { markKeyThrottled, markKeySuccess } from "../service-keys"
import type { ServiceKeyEntry } from "../service-keys"
import {
  CATEGORIES,
  PHASES,
  type AlchemyCategory,
  type SyncDirection,
  type SyncErrorDetail,
} from "./types"

// ─── Phase Helpers ───

export function phaseToString(phase: { direction: SyncDirection; category: AlchemyCategory }): string {
  return `${phase.direction}:${phase.category}`
}

export function parsePhase(phaseRaw: string | null | undefined): { direction: SyncDirection; category: AlchemyCategory } | null {
  if (!phaseRaw) return null
  const [direction, category] = phaseRaw.split(":") as [SyncDirection, AlchemyCategory]
  if ((direction !== "from" && direction !== "to") || !CATEGORIES.includes(category)) return null
  return { direction, category }
}

export function nextPhase(currentRaw: string | null | undefined): string | null {
  const current = parsePhase(currentRaw)
  if (!current) return phaseToString(PHASES[0])
  const idx = PHASES.findIndex((p) => p.direction === current.direction && p.category === current.category)
  if (idx < 0 || idx >= PHASES.length - 1) return null
  return phaseToString(PHASES[idx + 1])
}

// ─── Error Classification ───

export function classifyAlchemyError(status: number | undefined, message: string): SyncErrorDetail {
  const lower = message.toLowerCase()

  if (
    status === 401
    || status === 403
    || lower.includes("unauthorized")
    || lower.includes("invalid api key")
    || lower.includes("authentication")
  ) {
    return {
      code: "alchemy_unauthorized",
      message,
      status,
      retryable: false,
    }
  }

  if (
    lower.includes("method not found") ||
    lower.includes("unsupported method") ||
    lower.includes("not available") ||
    lower.includes("is not supported") ||
    (status === 400 && (lower.includes("invalid") || lower.includes("not found")))
  ) {
    return {
      code: "alchemy_unsupported_method",
      message,
      status,
      retryable: false,
    }
  }

  if (status === 429 || lower.includes("rate") || lower.includes("too many requests") || lower.includes("limit")) {
    return {
      code: "alchemy_rate_limited",
      message,
      status,
      retryable: true,
      retryAfterSec: 90,
    }
  }

  if (status && status >= 500) {
    return {
      code: "alchemy_upstream_error",
      message,
      status,
      retryable: true,
      retryAfterSec: 60,
    }
  }

  return {
    code: "alchemy_rpc_error",
    message,
    status,
    retryable: true,
    retryAfterSec: 45,
  }
}

export function throttleDetailFromError(error: unknown, fallbackMessage: string): SyncErrorDetail {
  if (isProviderThrottleError(error)) {
    const retryAfterSec = error.nextAllowedAt
      ? Math.min(300, Math.max(5, Math.ceil((error.nextAllowedAt.getTime() - Date.now()) / 1000)))
      : 90
    return {
      code: "alchemy_rate_limited",
      message: error.message,
      status: 429,
      retryable: true,
      retryAfterSec,
    }
  }

  const status = error != null && typeof error === "object" && typeof (error as Record<string, unknown>).status === "number"
    ? (error as { status: number }).status
    : undefined
  return classifyAlchemyError(status, error instanceof Error ? error.message : fallbackMessage)
}

// ─── Block & Value Helpers ───

export async function fetchLatestBlock(baseUrl: string): Promise<number> {
  const res = await fetch(baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    throw Object.assign(new Error(`Latest block request failed (${res.status}) ${txt.slice(0, 180)}`), { status: res.status })
  }

  const json = (await res.json()) as { result?: string; error?: { message?: string } }
  if (json.error) {
    throw new Error(json.error.message || "Latest block RPC error")
  }

  if (!json.result || !json.result.startsWith("0x")) {
    throw new Error("Latest block RPC returned malformed result")
  }

  return parseInt(json.result, 16)
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function deriveTransferValue(
  value: number | null,
  rawValue: string | null,
  decimals: number | null,
): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (!rawValue) return null

  try {
    const raw = rawValue.startsWith("0x") ? BigInt(rawValue) : BigInt(rawValue)
    const decimalPlaces = decimals ?? 0
    if (decimalPlaces <= 0) {
      const asNum = Number(raw)
      return Number.isFinite(asNum) ? asNum : null
    }

    const divisor = 10n ** BigInt(decimalPlaces)
    const whole = raw / divisor
    const fraction = raw % divisor
    const fractionStr = fraction.toString().padStart(decimalPlaces, "0").replace(/0+$/, "")
    const composed = fractionStr ? `${whole.toString()}.${fractionStr}` : whole.toString()
    const parsed = Number(composed)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}
