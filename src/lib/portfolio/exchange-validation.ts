/**
 * Exchange credential validation and error classification.
 */

import ccxt, { type Exchange } from "ccxt"
import { getExchangeById } from "./exchanges"
import type { ExchangeVerifyResult } from "./verification"
import { createExchange } from "./exchange-types"
import type { ExchangeCredentials } from "./exchange-types"

/** Validate exchange credentials by making a test API call */
export async function validateExchangeCredentials(
  exchangeId: string,
  credentials: ExchangeCredentials
): Promise<ExchangeVerifyResult> {
  const def = getExchangeById(exchangeId)
  if (!def) return { valid: false, code: "unknown", error: "Unknown exchange" }

  let exchange: Exchange | null = null
  try {
    exchange = createExchange(def.ccxtId, credentials)
    await exchange.fetchBalance()
    return { valid: true, code: "ok" }
  } catch (err) {
    return classifyExchangeVerifyError(exchangeId, err)
  }
}

function classifyExchangeVerifyError(exchangeId: string, err: unknown): ExchangeVerifyResult {
  const message = err instanceof Error ? err.message : "Unknown error"
  const lower = message.toLowerCase()

  if (err instanceof ccxt.RateLimitExceeded) {
    return { valid: false, code: "rate_limited", error: "Exchange rate limit reached while verifying credentials" }
  }
  if (err instanceof ccxt.PermissionDenied) {
    return { valid: false, code: "permission_denied", error: "API key lacks required read permissions" }
  }
  if (
    err instanceof ccxt.RequestTimeout
    || err instanceof ccxt.NetworkError
    || err instanceof ccxt.ExchangeNotAvailable
    || err instanceof ccxt.DDoSProtection
  ) {
    return { valid: false, code: "transient", error: "Exchange verification request timed out or exchange is temporarily unavailable" }
  }
  if (err instanceof ccxt.AuthenticationError) {
    if (isCoinbasePrivateKeyFormatError(exchangeId, lower)) {
      return {
        valid: false,
        code: "invalid_credentials",
        error: "Invalid Coinbase private key format. Paste the full EC private key including BEGIN/END lines.",
      }
    }
    return { valid: false, code: "invalid_credentials", error: "Invalid API key, secret, or passphrase" }
  }

  if (isCoinbasePrivateKeyFormatError(exchangeId, lower)) {
    return {
      valid: false,
      code: "invalid_credentials",
      error: "Invalid Coinbase private key format. Paste the full EC private key including BEGIN/END lines.",
    }
  }

  if (
    lower.includes("invalid api")
    || lower.includes("invalid-api-key")
    || lower.includes("invalid api key")
    || lower.includes("apikey does not exist")
    || lower.includes("api key does not exist")
    || lower.includes("invalid key")
    || lower.includes("invalid signature")
    || lower.includes("requires \"password\" credential")
    || lower.includes("requires 'password' credential")
    || lower.includes("must be authenticated")
    || lower.includes("unauthorized")
    || lower.includes("forbidden")
  ) {
    return { valid: false, code: "invalid_credentials", error: "Invalid API key, secret, or passphrase" }
  }

  if (lower.includes("permission")) {
    return { valid: false, code: "permission_denied", error: "API key lacks required read permissions" }
  }

  if (
    lower.includes("rate limit")
    || lower.includes("too many requests")
    || lower.includes("429")
  ) {
    return { valid: false, code: "rate_limited", error: "Exchange rate limit reached while verifying credentials" }
  }

  if (
    lower.includes("timeout")
    || lower.includes("timed out")
    || lower.includes("network")
    || lower.includes("temporarily unavailable")
    || lower.includes("service unavailable")
    || lower.includes("econnreset")
    || lower.includes("socket hang up")
    || lower.includes("exchange not available")
  ) {
    return { valid: false, code: "transient", error: "Exchange verification request timed out or exchange is temporarily unavailable" }
  }

  return { valid: false, code: "unknown", error: message }
}

function isCoinbasePrivateKeyFormatError(exchangeId: string, message: string): boolean {
  if (exchangeId !== "coinbase") return false
  return (
    message.includes("private key must be")
    || message.includes("begin ec private key")
    || message.includes("invalid pem")
    || message.includes("pem routines")
    || message.includes("secret has wrong format")
  )
}
