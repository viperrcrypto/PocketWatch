/**
 * Hard rules — non-overridable categorizations that run BEFORE the pattern cascade.
 * CC payments and inter-account transfers are always classified here.
 */

import type { CategoryResult } from "./category-types"

export interface TransactionContext {
  rawName: string
  merchantName: string | null
  amount: number
  accountType: string        // "credit", "depository", "loan", etc.
  accountSubtype: string | null
  plaidCategoryPrimary?: string | null
  plaidCategory?: string | null
}

export interface HardRuleResult extends CategoryResult {
  source: "hard_rule"
  ruleName: "cc_payment" | "transfer"
}

const TRANSFER_RESULT: CategoryResult = { category: "Transfer", subcategory: "Bank Transfer" }

// ─── CC Payment Detection ──────────────────────────────────────

const CC_PAYMENT_PATTERNS = [
  "PAYMENT THANK YOU",
  "PAYMENT RECEIVED",
  "AUTOPAY",
  "AUTOMATIC PAYMENT",
  "ONLINE PAYMENT",
  "MOBILE PAYMENT",
  "ACH PAYMENT",
  "ONLINE PMT",
  "MOBILE PMT",
  "EPAY",
  "PAYMENT - THANK",
  "CREDIT CRD",
  "CREDIT CARD PAYMENT",
  "CARDMEMBER PMT",
]

const CC_PLAID_CATEGORIES = [
  "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
  "LOAN_PAYMENTS",
]

/**
 * Detect credit card payments.
 * Fires when: Plaid says it's a CC payment, OR positive amount on credit account
 * with payment-related keywords in the name.
 */
export function detectCCPayment(tx: TransactionContext): HardRuleResult | null {
  // 1. Plaid category is most reliable
  if (tx.plaidCategory && CC_PLAID_CATEGORIES.includes(tx.plaidCategory)) {
    return { ...TRANSFER_RESULT, source: "hard_rule", ruleName: "cc_payment" }
  }
  if (tx.plaidCategoryPrimary && CC_PLAID_CATEGORIES.includes(tx.plaidCategoryPrimary)) {
    return { ...TRANSFER_RESULT, source: "hard_rule", ruleName: "cc_payment" }
  }

  // 2. Pattern match: positive amount on credit account + payment keywords
  //    Plaid represents CC payments as positive amounts on credit accounts
  const name = (tx.merchantName ?? tx.rawName).toUpperCase()
  const isOnCreditAccount = tx.accountType === "credit"
  const isPositive = tx.amount > 0

  if (isOnCreditAccount && isPositive) {
    if (CC_PAYMENT_PATTERNS.some((p) => name.includes(p))) {
      return { ...TRANSFER_RESULT, source: "hard_rule", ruleName: "cc_payment" }
    }
  }

  // 3. Pattern match on depository side (debit for CC payment)
  //    Negative amount on depository + payment keywords
  const isOnDepository = tx.accountType === "depository"
  const isNegative = tx.amount < 0

  if (isOnDepository && isNegative) {
    if (CC_PAYMENT_PATTERNS.some((p) => name.includes(p))) {
      return { ...TRANSFER_RESULT, source: "hard_rule", ruleName: "cc_payment" }
    }
  }

  return null
}

// ─── Transfer Detection by Name ────────────────────────────────

const TRANSFER_PATTERNS = [
  "TRANSFER TO",
  "TRANSFER FROM",
  "WIRE TRANSFER",
  "ACH TRANSFER",
  "ACH DEPOSIT",
  "ACH CREDIT",
  "ACH DEBIT",
  "EXTERNAL TRANSFER",
  "INTERNAL TRANSFER",
  "FUNDS TRANSFER",
  "MOBILE TRANSFER",
  "ONLINE TRANSFER",
]

const TRANSFER_EXACT = [
  "VENMO",
  "ZELLE",
  "CASH APP",
  "CASHAPP",
]

const TRANSFER_PLAID_PREFIXES = [
  "TRANSFER_IN",
  "TRANSFER_OUT",
]

/**
 * Detect transfers by name patterns and Plaid category.
 */
export function detectTransferByName(tx: TransactionContext): HardRuleResult | null {
  // 1. Plaid category
  if (tx.plaidCategoryPrimary) {
    if (TRANSFER_PLAID_PREFIXES.some((p) => tx.plaidCategoryPrimary!.startsWith(p))) {
      return { ...TRANSFER_RESULT, source: "hard_rule", ruleName: "transfer" }
    }
  }

  const name = (tx.merchantName ?? tx.rawName).toUpperCase()

  // 2. Exact match for known transfer services
  if (TRANSFER_EXACT.some((t) => name.includes(t))) {
    return { ...TRANSFER_RESULT, source: "hard_rule", ruleName: "transfer" }
  }

  // 3. Transfer phrase patterns
  if (TRANSFER_PATTERNS.some((p) => name.includes(p))) {
    return { ...TRANSFER_RESULT, source: "hard_rule", ruleName: "transfer" }
  }

  return null
}

// ─── Entry Point ───────────────────────────────────────────────

/**
 * Run all hard rules in priority order. Returns first match or null.
 * CC payment detection runs first (more specific), then general transfers.
 */
export function applyHardRules(tx: TransactionContext): HardRuleResult | null {
  return detectCCPayment(tx) ?? detectTransferByName(tx) ?? null
}
