/**
 * Transaction categorization engine.
 * New cascade: hard rules → confidence rules → Plaid → merchant map → keywords → fallback.
 *
 * Re-exports all types and data from split modules for backward compatibility.
 */

// Re-export types and data for backward compatibility
export { CATEGORIES, type Category, type CategoryResult, type CategorySuggestion, type CategoryRule, type EnrichedCategoryResult, type CategorySource } from "./category-types"
export { MERCHANT_MAP, matchMerchantMap } from "./merchant-map"
export { matchKeywords } from "./keyword-map"
export { PLAID_CATEGORY_MAP } from "./plaid-category-map"
export { applyHardRules, type TransactionContext, type HardRuleResult } from "./hard-rules"
export { applyConfidenceRules, buildConfidenceRuleSet, computeNewConfidence, CONFIDENCE, type ConfidenceRule, type ConfidenceRuleMatch } from "./confidence-rules"

import type { CategoryResult, CategorySuggestion, EnrichedCategoryResult } from "./category-types"
import type { ConfidenceRule } from "./confidence-rules"
import { applyConfidenceRules, CONFIDENCE } from "./confidence-rules"
import { applyHardRules, type TransactionContext } from "./hard-rules"
import { matchMerchantMap, MERCHANT_MAP } from "./merchant-map"
import { matchKeywords } from "./keyword-map"
import { PLAID_CATEGORY_MAP } from "./plaid-category-map"

/**
 * Clean merchant name: strip prefixes, trailing card refs, location info.
 */
export function cleanMerchantName(rawName: string): string {
  let name = rawName.trim()

  const prefixes = [
    "ACH CREDIT ", "ACH DEBIT ", "ACH PMT ", "DEBIT CRD ", "POS DEBIT ",
    "POS ", "WIRE ",
    "TST*", "TST *", "SQ *", "SQC*", "PAYPAL *", "PP*",
    "GOOGLE *", "AMZN ", "AMZN*", "APL*", "CKE*", "DD *",
    "SP ", "SP*", "INT ", "WPY*", "BLS*",
  ]
  for (const prefix of prefixes) {
    if (name.toUpperCase().startsWith(prefix)) {
      name = name.slice(prefix.length).trim()
      break
    }
  }

  name = name.replace(/\s+(CRD\s+)?ACH\s+TRAN(SACTION)?\s+ON\s+\d{2}\/\d{2}$/i, "")
  name = name.replace(/\s+DEBIT\s+ON\s+\d{2}\/\d{2}$/i, "")
  name = name.replace(/\s+CREDIT\s+ON\s+\d{2}\/\d{2}$/i, "")
  name = name.replace(/\s+x{2,}\d{4}$/i, "")
  name = name.replace(/\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/, "")
  name = name.replace(/\s+#\d+$/, "")
  name = name.replace(/\s+\d{3,}$/, "")

  return name.trim()
}

/**
 * Main categorization function with enriched result.
 * New cascade:
 * 1. Hard rules (CC payments, transfers — non-overridable)
 * 2. User confidence rules (≥0.5 confidence, sorted by confidence desc)
 * 3. Plaid category mapping
 * 4. Built-in merchant map
 * 5. Statement credit detection
 * 6. Keyword matching
 * 7. Fallback: Uncategorized
 */
export function categorizeTransaction(
  tx: {
    merchantName: string
    rawName: string
    plaidCategory?: string | null
    plaidCategoryPrimary?: string | null
    amount?: number
    accountType?: string
    accountSubtype?: string | null
  },
  userRules: ConfidenceRule[] = []
): EnrichedCategoryResult {
  const cleaned = cleanMerchantName(tx.merchantName || tx.rawName)

  // 1. Hard rules (CC payments, transfers)
  if (tx.accountType) {
    const hardCtx: TransactionContext = {
      rawName: tx.rawName,
      merchantName: tx.merchantName,
      amount: tx.amount ?? 0,
      accountType: tx.accountType,
      accountSubtype: tx.accountSubtype ?? null,
      plaidCategoryPrimary: tx.plaidCategoryPrimary,
      plaidCategory: tx.plaidCategory,
    }
    const hardResult = applyHardRules(hardCtx)
    if (hardResult) {
      return { ...hardResult, confidence: 1.0, needsReview: false }
    }
  }

  // 2. User confidence rules
  const ruleMatch = applyConfidenceRules(cleaned, userRules)
  if (ruleMatch) {
    return {
      ...ruleMatch.result,
      source: "rule",
      confidence: ruleMatch.rule.confidence,
      needsReview: ruleMatch.needsReview,
      ruleId: ruleMatch.rule.id,
    }
  }

  // 3. Plaid category mapping
  if (tx.plaidCategory) {
    const parts = tx.plaidCategory.split("|").map((s) => s.trim())
    for (const part of parts.reverse()) {
      if (part && PLAID_CATEGORY_MAP[part]) {
        return { ...PLAID_CATEGORY_MAP[part], source: "plaid", confidence: 0.85, needsReview: false }
      }
    }
  }

  // 4. Built-in merchant map
  const merchantResult = matchMerchantMap(cleaned)
  if (merchantResult) {
    const isExact = !!MERCHANT_MAP[cleaned.toUpperCase()]
    return { ...merchantResult, source: "merchant_map", confidence: isExact ? 0.9 : 0.75, needsReview: false }
  }

  // 5. Statement credit detection
  if (tx.amount != null && tx.amount < 0) {
    const creditKeywords = ["STATEMENT CREDIT", "REWARD", "CASHBACK", "REBATE", "COURTESY", "PROMO", "ADJUSTMENT"]
    if (creditKeywords.some((k) => cleaned.toUpperCase().includes(k))) {
      return { category: "Fees & Charges", subcategory: "Statement Credit", source: "keyword", confidence: 0.8, needsReview: false }
    }
  }

  // 6. Keyword matching
  const keywordResult = matchKeywords(cleaned)
  if (keywordResult) {
    return { ...keywordResult, source: "keyword", confidence: 0.7, needsReview: false }
  }

  // 7. Fallback
  return { category: "Uncategorized", subcategory: null, source: "keyword", confidence: 0, needsReview: false }
}

/**
 * Legacy categorization wrapper for backward compatibility.
 * Returns plain CategoryResult without enrichment.
 */
export function categorizeTransactionLegacy(
  tx: { merchantName: string; rawName: string; plaidCategory?: string | null; amount?: number },
  userRules: ConfidenceRule[] = []
): CategoryResult {
  const result = categorizeTransaction(tx, userRules)
  return { category: result.category, subcategory: result.subcategory }
}

/**
 * Shared WHERE clause for uncategorized transaction queries.
 */
export function uncategorizedWhere(userId: string) {
  return {
    userId,
    isDuplicate: false,
    isExcluded: false,
    OR: [{ category: null }, { category: "" }, { category: "Uncategorized" }],
  }
}

/**
 * WHERE clause for transactions needing review (auto-applied with low confidence).
 */
export function needsReviewWhere(userId: string) {
  return {
    userId,
    isDuplicate: false,
    isExcluded: false,
    needsReview: true,
    category: { not: null },
    reviewSkippedAt: null,
  }
}

/**
 * Generate ranked category suggestions from ALL cascade sources (no short-circuit).
 * Returns 3-5 deduplicated suggestions ordered by confidence.
 */
export function suggestCategories(
  tx: {
    merchantName: string
    rawName: string
    plaidCategory?: string | null
    amount?: number
    accountType?: string
    accountSubtype?: string | null
  },
  userRules: ConfidenceRule[],
  correctionHistory?: Map<string, string>,
  topUsedCategories?: string[]
): CategorySuggestion[] {
  const cleaned = cleanMerchantName(tx.merchantName || tx.rawName)
  const suggestions: CategorySuggestion[] = []

  // 1. Hard rules
  if (tx.accountType) {
    const hardCtx: TransactionContext = {
      rawName: tx.rawName,
      merchantName: tx.merchantName ?? null,
      amount: tx.amount ?? 0,
      accountType: tx.accountType,
      accountSubtype: tx.accountSubtype ?? null,
      plaidCategory: tx.plaidCategory,
      plaidCategoryPrimary: (tx as { plaidCategoryPrimary?: string | null }).plaidCategoryPrimary,
    }
    const hardResult = applyHardRules(hardCtx)
    if (hardResult) {
      suggestions.push({ ...hardResult, source: "rule", confidence: "high" })
    }
  }

  // 2. User confidence rules
  const ruleMatch = applyConfidenceRules(cleaned, userRules)
  if (ruleMatch) {
    const conf = ruleMatch.rule.confidence >= CONFIDENCE.AUTO_APPLY ? "high"
      : ruleMatch.rule.confidence >= CONFIDENCE.DISABLED ? "medium" : "low"
    suggestions.push({ ...ruleMatch.result, source: "rule", confidence: conf })
  }

  // 3. Plaid category
  if (tx.plaidCategory) {
    const parts = tx.plaidCategory.split("|").map((s) => s.trim())
    for (const part of [...parts].reverse()) {
      if (part && PLAID_CATEGORY_MAP[part]) {
        suggestions.push({ ...PLAID_CATEGORY_MAP[part], source: "plaid", confidence: "medium" })
        break
      }
    }
  }

  // 4. Merchant map
  const merchantResult = matchMerchantMap(cleaned)
  if (merchantResult) {
    const isExact = !!MERCHANT_MAP[cleaned.toUpperCase()]
    suggestions.push({ ...merchantResult, source: "merchant_map", confidence: isExact ? "high" : "medium" })
  }

  // 5. Keyword match
  const keywordResult = matchKeywords(cleaned)
  if (keywordResult) {
    suggestions.push({ ...keywordResult, source: "keyword", confidence: "low" })
  }

  // 6. Correction history
  if (correctionHistory) {
    const historyCategory = correctionHistory.get(cleaned.toUpperCase())
    if (historyCategory) {
      suggestions.push({ category: historyCategory, subcategory: null, source: "history", confidence: "medium" })
    }
  }

  // Deduplicate by category (keep highest confidence)
  const confidenceRank = { high: 3, medium: 2, low: 1 }
  const seen = new Map<string, CategorySuggestion>()
  for (const s of suggestions) {
    const existing = seen.get(s.category)
    if (!existing || confidenceRank[s.confidence] > confidenceRank[existing.confidence]) {
      seen.set(s.category, s)
    }
  }

  const deduped = [...seen.values()]
    .sort((a, b) => confidenceRank[b.confidence] - confidenceRank[a.confidence])

  if (deduped.length < 3 && topUsedCategories) {
    for (const cat of topUsedCategories) {
      if (deduped.length >= 5) break
      if (!seen.has(cat) && cat !== "Uncategorized") {
        deduped.push({ category: cat, subcategory: null, source: "top_used", confidence: "low" })
        seen.set(cat, deduped[deduped.length - 1])
      }
    }
  }

  return deduped.slice(0, 5)
}
