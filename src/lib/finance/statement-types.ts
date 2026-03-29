/**
 * Shared types for bank statement upload and data coverage analysis.
 */

export type BankFormat =
  | "chase"
  | "bofa"
  | "amex"
  | "wells_fargo"
  | "capital_one"
  | "discover"
  | "generic"
  | "ai_pdf"

export interface ParsedRow {
  date: Date
  name: string
  amount: number
  checkNumber?: string
}

export interface ParseResult {
  format: BankFormat
  rows: ParsedRow[]
  errors: string[]
  headerRow: string[]
}

export interface AccountCoverage {
  accountId: string
  accountName: string
  institutionName: string
  provider: string
  type: string
  mask: string | null
  earliestTransaction: string | null
  latestTransaction: string | null
  totalTransactions: number
  monthsWithData: string[]
  monthsMissing: string[]
  monthsNoActivity: string[]
  coveragePercent: number
}

export interface StatementUploadResult {
  format: BankFormat
  totalRows: number
  inserted: number
  skipped: number
  duplicates: number
  errors: string[]
}
