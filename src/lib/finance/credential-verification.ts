import {
  Configuration,
  PlaidApi,
  Products,
  CountryCode,
} from "plaid"

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://production.plaid.com",
  production: "https://production.plaid.com",
}
import type {
  FinanceVerificationPayload,
  PlaidCredentialVerifyResult,
  PlaidVerifyCode,
} from "./verification-types"
export type { FinanceVerificationPayload, PlaidCredentialVerifyResult, PlaidVerifyCode } from "./verification-types"

interface PlaidErrorDetails {
  status?: number
  errorType?: string
  errorCode?: string
  errorMessage?: string
  displayMessage?: string
  rawMessage?: string
}

const HARD_FAILURE_CODES = new Set<PlaidVerifyCode>([
  "invalid_credentials",
  "invalid_environment",
  "permission_denied",
])

const TRANSIENT_MESSAGE_PATTERNS = [
  "timeout",
  "timed out",
  "temporarily unavailable",
  "try again",
  "network",
  "socket",
  "ecconn",
  "dns",
  "unavailable",
]

function createPlaidClient(clientId: string, secret: string, environment: string): PlaidApi {
  const configuration = new Configuration({
    basePath: PLAID_BASE_URLS[environment] ?? PLAID_BASE_URLS.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  })

  return new PlaidApi(configuration)
}

function parsePlaidError(err: unknown): PlaidErrorDetails {
  const details: PlaidErrorDetails = {}

  if (err && typeof err === "object") {
    const maybe = err as {
      message?: unknown
      status?: unknown
      response?: {
        status?: unknown
        data?: unknown
      }
    }

    if (typeof maybe.message === "string") details.rawMessage = maybe.message
    if (typeof maybe.status === "number") details.status = maybe.status

    const response = maybe.response
    if (response && typeof response === "object") {
      if (typeof response.status === "number") details.status = response.status

      const data = response.data
      if (data && typeof data === "object") {
        const plaidData = data as {
          error_type?: unknown
          error_code?: unknown
          error_message?: unknown
          display_message?: unknown
          message?: unknown
        }
        if (typeof plaidData.error_type === "string") details.errorType = plaidData.error_type
        if (typeof plaidData.error_code === "string") details.errorCode = plaidData.error_code
        if (typeof plaidData.error_message === "string") details.errorMessage = plaidData.error_message
        if (typeof plaidData.display_message === "string") details.displayMessage = plaidData.display_message
        if (!details.errorMessage && typeof plaidData.message === "string") details.errorMessage = plaidData.message
      } else if (typeof data === "string") {
        details.errorMessage = data
      }
    }
  } else if (typeof err === "string") {
    details.rawMessage = err
  }

  return details
}

function classifyPlaidError(details: PlaidErrorDetails): PlaidCredentialVerifyResult {
  const status = details.status
  const code = (details.errorCode ?? "").toUpperCase()
  const type = (details.errorType ?? "").toUpperCase()
  const message = details.displayMessage ?? details.errorMessage ?? details.rawMessage ?? ""
  const lowered = message.toLowerCase()

  if (status === 429 || code.includes("RATE_LIMIT") || type === "RATE_LIMIT_EXCEEDED") {
    return {
      valid: false,
      code: "rate_limited",
      error: "Plaid rate limit reached. Please retry in a moment.",
    }
  }

  if (status === 403 || code.includes("PERMISSION")) {
    return {
      valid: false,
      code: "permission_denied",
      error: message || "Plaid credentials do not have required permissions.",
    }
  }

  if (
    code === "INVALID_ENVIRONMENT" ||
    (lowered.includes("environment") &&
      (lowered.includes("sandbox") || lowered.includes("development") || lowered.includes("production")) &&
      (lowered.includes("mismatch") || lowered.includes("does not") || lowered.includes("invalid")))
  ) {
    return {
      valid: false,
      code: "invalid_environment",
      error: "Plaid environment mismatch. Verify sandbox/development/production selection.",
    }
  }

  if (
    status === 401 ||
    code === "INVALID_API_KEYS" ||
    code === "INVALID_SECRET" ||
    lowered.includes("invalid api") ||
    lowered.includes("invalid client") ||
    lowered.includes("invalid secret") ||
    (lowered.includes("client_id") && lowered.includes("secret"))
  ) {
    return {
      valid: false,
      code: "invalid_credentials",
      error: "Invalid Plaid credentials. Check Client ID and Secret.",
    }
  }

  if (
    (typeof status === "number" && status >= 500) ||
    type === "API_ERROR" ||
    TRANSIENT_MESSAGE_PATTERNS.some((pattern) => lowered.includes(pattern))
  ) {
    return {
      valid: false,
      code: "transient",
      error: "Plaid verification is temporarily unavailable. Please retry.",
    }
  }

  return {
    valid: false,
    code: "unknown",
    error: message || "Plaid verification failed for an unknown reason.",
  }
}

export async function validatePlaidCredentials(params: {
  clientId: string
  secret: string
  environment: string
  probeUserId?: string
}): Promise<PlaidCredentialVerifyResult> {
  const clientId = params.clientId.trim()
  const secret = params.secret.trim()

  if (!clientId || !secret) {
    return {
      valid: false,
      code: "invalid_credentials",
      error: "Both Plaid Client ID and Secret are required.",
    }
  }

  const client = createPlaidClient(clientId, secret, params.environment)

  try {
    await client.linkTokenCreate({
      user: { client_user_id: params.probeUserId ?? `verify_${Date.now()}` },
      client_name: "PocketWatch Verification",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    })

    return { valid: true, code: "ok" }
  } catch (err) {
    return classifyPlaidError(parsePlaidError(err))
  }
}

export function toFinanceVerificationPayload(result: PlaidCredentialVerifyResult): FinanceVerificationPayload {
  if (result.valid || result.code === "ok") {
    return {
      verified: true,
      verificationState: "verified",
      verifyCode: "ok",
      verifyError: null,
    }
  }

  if (HARD_FAILURE_CODES.has(result.code)) {
    return {
      verified: false,
      verificationState: "failed",
      verifyCode: result.code,
      verifyError: result.error ?? "Plaid credential verification failed.",
    }
  }

  return {
    verified: false,
    verificationState: "unknown",
    verifyCode: result.code,
    verifyError: result.error ?? "Plaid verification is currently unavailable.",
  }
}
