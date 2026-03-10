export type FinanceVerificationState = "verified" | "failed" | "unknown"

export type PlaidVerifyCode =
  | "ok"
  | "invalid_credentials"
  | "invalid_environment"
  | "permission_denied"
  | "rate_limited"
  | "transient"
  | "unknown"

export interface PlaidCredentialVerifyResult {
  valid: boolean
  code: PlaidVerifyCode
  error?: string
}

export interface FinanceVerificationPayload {
  verified: boolean
  verificationState: FinanceVerificationState
  verifyCode: PlaidVerifyCode
  verifyError: string | null
}
