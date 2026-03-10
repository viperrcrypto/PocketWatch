export type ExternalServiceVerificationState = "verified" | "failed" | "unknown"

export type ExchangeVerifyCode =
  | "ok"
  | "invalid_credentials"
  | "permission_denied"
  | "rate_limited"
  | "transient"
  | "unknown"

export interface ExchangeVerifyResult {
  valid: boolean
  code: ExchangeVerifyCode
  error?: string
}

interface ResolvedExchangeVerification {
  persistedVerified: boolean
  persistedVerifyError: string | null
  responseVerified: boolean
  responseVerificationState: ExternalServiceVerificationState
  responseVerifyError: string | null
}

const HARD_FAILURE_CODES = new Set<ExchangeVerifyCode>([
  "invalid_credentials",
  "permission_denied",
])

export function deriveVerificationState(
  verified: boolean,
  verifyError?: string | null,
): ExternalServiceVerificationState {
  if (verified) return "verified"
  if (verifyError) return "failed"
  return "unknown"
}

export function resolveExchangeVerification(
  result: ExchangeVerifyResult,
  previousVerified: boolean,
): ResolvedExchangeVerification {
  if (result.valid || result.code === "ok") {
    return {
      persistedVerified: true,
      persistedVerifyError: null,
      responseVerified: true,
      responseVerificationState: "verified",
      responseVerifyError: null,
    }
  }

  if (HARD_FAILURE_CODES.has(result.code)) {
    const message = result.error ?? "Exchange credentials are invalid"
    return {
      persistedVerified: false,
      persistedVerifyError: message,
      responseVerified: false,
      responseVerificationState: "failed",
      responseVerifyError: message,
    }
  }

  const warning = result.error ?? "Exchange verification is temporarily unavailable"
  return {
    persistedVerified: previousVerified,
    persistedVerifyError: null,
    responseVerified: previousVerified,
    responseVerificationState: "unknown",
    responseVerifyError: warning,
  }
}
