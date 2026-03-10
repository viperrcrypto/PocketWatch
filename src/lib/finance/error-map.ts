import { Prisma } from "@/generated/prisma/client"

export interface FinanceErrorResult {
  message: string
  status: number
}

interface PlaidErrorDetails {
  status?: number
  errorCode?: string
  errorType?: string
  errorMessage?: string
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === "string") return err
  if (err && typeof err === "object") {
    const maybe = err as {
      message?: unknown
      cause?: { message?: unknown }
      response?: { data?: unknown }
    }
    const responseData = maybe.response?.data
    if (responseData && typeof responseData === "object") {
      const data = responseData as {
        error_message?: unknown
        display_message?: unknown
        message?: unknown
      }
      if (typeof data.error_message === "string") return data.error_message
      if (typeof data.display_message === "string") return data.display_message
      if (typeof data.message === "string") return data.message
    }
    if (typeof maybe.message === "string") return maybe.message
    if (typeof maybe.cause?.message === "string") return maybe.cause.message
    try {
      return JSON.stringify(err)
    } catch {
      return ""
    }
  }
  return ""
}

function getErrorCode(err: unknown): string {
  if (!err || typeof err !== "object") return ""
  const maybe = err as { code?: unknown; cause?: { code?: unknown } }
  if (typeof maybe.code === "string") return maybe.code
  if (typeof maybe.cause?.code === "string") return maybe.cause.code
  return ""
}

function getPlaidErrorDetails(err: unknown): PlaidErrorDetails {
  if (!err || typeof err !== "object") return {}

  const maybe = err as {
    status?: unknown
    response?: {
      status?: unknown
      data?: unknown
    }
  }

  const details: PlaidErrorDetails = {}
  if (typeof maybe.status === "number") details.status = maybe.status
  if (typeof maybe.response?.status === "number") details.status = maybe.response.status

  const data = maybe.response?.data
  if (data && typeof data === "object") {
    const payload = data as {
      error_code?: unknown
      error_type?: unknown
      error_message?: unknown
      display_message?: unknown
      message?: unknown
    }
    if (typeof payload.error_code === "string") details.errorCode = payload.error_code
    if (typeof payload.error_type === "string") details.errorType = payload.error_type
    if (typeof payload.error_message === "string") details.errorMessage = payload.error_message
    if (!details.errorMessage && typeof payload.display_message === "string") details.errorMessage = payload.display_message
    if (!details.errorMessage && typeof payload.message === "string") details.errorMessage = payload.message
  }

  return details
}

export function mapFinanceError(
  err: unknown,
  fallbackMessage: string
): FinanceErrorResult {
  const message = getErrorMessage(err)
  const code = getErrorCode(err)
  const plaid = getPlaidErrorDetails(err)
  const plaidCode = (plaid.errorCode ?? "").toUpperCase()
  const plaidMessage = plaid.errorMessage ?? message
  const plaidStatus = typeof plaid.status === "number" ? plaid.status : undefined
  const loweredMessage = message.toLowerCase()
  const isP2021 =
    (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") ||
    code === "P2021" ||
    message.includes("P2021")
  const isP1003 =
    code === "P1003" ||
    message.includes("P1003") ||
    message.includes("Database `") && message.includes("does not exist")
  const isP1001 =
    code === "P1001" ||
    message.includes("P1001")

  if (
    message.includes("FINANCE_ENCRYPTION_KEY") ||
    message.includes("ENCRYPTION_KEY")
  ) {
    return {
      message:
        "Finance encryption key is missing. Set ENCRYPTION_KEY (or FINANCE_ENCRYPTION_KEY) and restart the server.",
      status: 500,
    }
  }

  if (message.includes("Plaid credentials not configured")) {
    return {
      message:
        "Plaid API keys are not configured. Save your Plaid Client ID and Secret in Finance Settings first.",
      status: 400,
    }
  }

  if (plaidCode === "INVALID_API_KEYS" || plaidCode === "INVALID_SECRET") {
    return {
      message: "Invalid Plaid credentials. Check Client ID and Secret in Finance Settings.",
      status: 400,
    }
  }

  if (
    plaidCode === "INVALID_ENVIRONMENT" ||
    (loweredMessage.includes("environment") &&
      (loweredMessage.includes("sandbox") || loweredMessage.includes("development") || loweredMessage.includes("production")))
  ) {
    return {
      message: "Plaid environment mismatch. Verify sandbox/development/production in Finance Settings.",
      status: 400,
    }
  }

  if (plaidCode || plaid.errorType || plaid.errorMessage) {
    if (plaidStatus === 429) {
      return {
        message: "Plaid rate limit reached. Please retry in a moment.",
        status: 429,
      }
    }
    if (plaidStatus === 401 || plaidStatus === 403) {
      return {
        message: plaidMessage || "Plaid authentication failed.",
        status: plaidStatus,
      }
    }
    if (plaidStatus && plaidStatus >= 500) {
      return {
        message: "Plaid service is temporarily unavailable. Please retry.",
        status: 503,
      }
    }

    return {
      message: plaidMessage || fallbackMessage,
      status: plaidStatus && plaidStatus >= 400 && plaidStatus < 500 ? plaidStatus : 400,
    }
  }

  if (isP2021) {
    return {
      message:
        "Finance database tables are missing. Run `prisma migrate deploy` to create finance schema.",
      status: 500,
    }
  }

  if (isP1003) {
    return {
      message:
        "Database in DATABASE_URL does not exist. Verify DATABASE_URL and restart the server.",
      status: 500,
    }
  }

  if (isP1001) {
    return {
      message:
        "Unable to connect to the database. Verify DATABASE_URL and that Postgres is running.",
      status: 503,
    }
  }

  if (
    message.includes("relation") &&
    (message.includes("Finance") || message.includes("finance"))
  ) {
    return {
      message:
        "Finance database schema is out of date. Run `prisma migrate deploy` and restart the server.",
      status: 500,
    }
  }

  if (message.includes("SimpleFIN")) {
    return {
      message,
      status: message.includes("401") || message.includes("403") ? 401 : 400,
    }
  }

  return { message: fallbackMessage, status: 500 }
}
