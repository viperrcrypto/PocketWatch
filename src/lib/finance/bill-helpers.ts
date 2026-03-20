/**
 * Shared helpers for bill date projection and display name formatting.
 */

import { enrichMerchantName, type BillType } from "./bill-type-classifier"

/** Detect gibberish merchant names (raw Plaid tokens, base64, hex strings) */
export function isGibberishName(name: string): boolean {
  const n = name.trim()
  if (n.length === 0) return true
  if (n.length > 20 && !/\s/.test(n)) return true
  if (/^[A-Za-z0-9+/=]{20,}$/.test(n)) return true
  if (/^[0-9a-f]{16,}$/i.test(n)) return true
  return false
}

/** Check if a date falls within a given month (YYYY-MM) */
export function isInMonth(date: Date, monthStr: string): boolean {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}` === monthStr
}

/** Get current month as YYYY-MM */
export function currentMonthStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

/** Advance a date by one period of the given frequency (mutates the date) */
export function advanceDate(date: Date, frequency: string): void {
  switch (frequency) {
    case "weekly": date.setDate(date.getDate() + 7); break
    case "biweekly": date.setDate(date.getDate() + 14); break
    case "monthly": date.setMonth(date.getMonth() + 1); break
    case "quarterly": date.setMonth(date.getMonth() + 3); break
    case "semi_annual": date.setMonth(date.getMonth() + 6); break
    case "yearly": date.setFullYear(date.getFullYear() + 1); break
    default: date.setDate(date.getDate() + 30); break
  }
}

/** Project the next charge date from last charge + frequency */
export function projectNextDate(lastDate: Date | string | null, frequency: string): Date | null {
  if (!lastDate) return null
  const next = new Date(lastDate)
  if (isNaN(next.getTime())) return null
  advanceDate(next, frequency)
  return next
}

/** Map Plaid frequency strings to normalized frequency */
export const PLAID_FREQ: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  SEMI_MONTHLY: "biweekly",
  MONTHLY: "monthly",
  ANNUALLY: "yearly",
}

export interface BillItem {
  id: string
  merchantName: string
  amount: number
  frequency: string
  nextDueDate: string
  daysUntil: number
  category: string | null
  billType: BillType | "cc_payment"
  isPaid?: boolean
  logoUrl?: string | null
  accountName?: string | null
  accountMask?: string | null
  institutionName?: string | null
}

type AccountInfo = { mask: string | null; institution: { institutionName: string | null } | null }

/** Build display name for a subscription bill */
export function buildSubDisplayName(
  s: { merchantName: string; nickname: string | null; category: string | null },
  acct: AccountInfo | null | undefined,
): string {
  if (s.nickname) return s.nickname
  if (isGibberishName(s.merchantName)) return s.category ?? "Unknown"
  return enrichMerchantName(s.merchantName, acct?.institution?.institutionName ?? null, acct?.mask ?? null)
}

/** Build display name for a credit card payment */
export function buildCCDisplayName(cc: {
  account: { name: string; mask: string | null; institution: { institutionName: string | null } | null } | null
}): string {
  const institution = cc.account?.institution?.institutionName
  const rawName = cc.account?.name
  const mask = cc.account?.mask

  const isUsefulCardName = (n: string | null | undefined): n is string =>
    !!n && !isGibberishName(n)
    && !/^credit\s*card$/i.test(n.trim())
    && n.length > 5  // Skip short names like "Z. KAL" (account holder names)

  if (institution && mask) return `${institution} ••••${mask}`
  if (isUsefulCardName(rawName)) return rawName
  if (institution) return `${institution} Card`
  if (mask) return `Card ••••${mask}`
  return "Credit Card Payment"
}
