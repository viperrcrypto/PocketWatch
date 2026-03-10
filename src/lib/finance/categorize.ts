/**
 * Transaction categorization engine.
 * Cascade: user rules -> Plaid mapping -> merchant map -> keywords -> fallback.
 *
 * Re-exports all types and data from split modules for backward compatibility.
 */

// Re-export types and data for backward compatibility
export { CATEGORIES, type Category, type CategoryResult, type CategorySuggestion, type CategoryRule } from "./category-types"
export { MERCHANT_MAP, matchMerchantMap } from "./merchant-map"
export { matchKeywords } from "./keyword-map"
export { PLAID_CATEGORY_MAP } from "./plaid-category-map"

import type { CategoryResult, CategoryRule, CategorySuggestion } from "./category-types"
import { matchMerchantMap, MERCHANT_MAP } from "./merchant-map"
import { matchKeywords } from "./keyword-map"
import { PLAID_CATEGORY_MAP } from "./plaid-category-map"

/**
 * Clean merchant name: strip prefixes, trailing card refs, location info.
 */
export function cleanMerchantName(rawName: string): string {
  let name = rawName.trim()

  // Strip common prefixes (payment processors + banking prefixes)
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

  // Strip trailing banking suffixes (e.g., "CRD ACH TRAN ON 03/09", "DEBIT ON 03/09")
  name = name.replace(/\s+(CRD\s+)?ACH\s+TRAN(SACTION)?\s+ON\s+\d{2}\/\d{2}$/i, "")
  name = name.replace(/\s+DEBIT\s+ON\s+\d{2}\/\d{2}$/i, "")
  name = name.replace(/\s+CREDIT\s+ON\s+\d{2}\/\d{2}$/i, "")

  // Strip trailing card number refs (e.g., "xxxx1234")
  name = name.replace(/\s+x{2,}\d{4}$/i, "")

  // Strip trailing location info (e.g., "City, ST" or "City ST 12345")
  name = name.replace(/\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/, "")
  name = name.replace(/\s+#\d+$/, "")

  // Strip trailing numbers that look like store IDs
  name = name.replace(/\s+\d{3,}$/, "")

  return name.trim()
}

/**
 * Apply user-defined category rules (highest priority in cascade).
 */
export function applyCategoryRules(
  merchantName: string,
  rules: CategoryRule[]
): CategoryResult | null {
  const sorted = [...rules].sort((a, b) => b.priority - a.priority)
  const upper = merchantName.toUpperCase()

  for (const rule of sorted) {
    const value = rule.matchValue.toUpperCase()
    let matched = false

    switch (rule.matchType) {
      case "exact":
        matched = upper === value
        break
      case "starts_with":
        matched = upper.startsWith(value)
        break
      case "contains":
        matched = upper.includes(value)
        break
    }

    if (matched) {
      return { category: rule.category, subcategory: rule.subcategory }
    }
  }

  return null
}

/**
 * Main categorization function. Cascade:
 * 1. User rules
 * 2. Plaid category mapping (authoritative when present)
 * 3. Built-in merchant map (identifies known merchants before generic checks)
 * 4. Statement credit detection (only fires if no merchant/Plaid match)
 * 5. Keyword matching
 * 6. Fallback: Uncategorized
 */
export function categorizeTransaction(
  tx: { merchantName: string; rawName: string; plaidCategory?: string | null; amount?: number },
  userRules: CategoryRule[] = []
): CategoryResult {
  const cleaned = cleanMerchantName(tx.merchantName || tx.rawName)

  // 1. User rules (highest priority)
  const ruleResult = applyCategoryRules(cleaned, userRules)
  if (ruleResult) return ruleResult

  // 2. Plaid category mapping (authoritative when present)
  if (tx.plaidCategory) {
    const parts = tx.plaidCategory.split("|").map((s) => s.trim())
    for (const part of parts.reverse()) {
      if (part && PLAID_CATEGORY_MAP[part]) {
        return PLAID_CATEGORY_MAP[part]
      }
    }
  }

  // 3. Built-in merchant map (identifies known merchants before generic checks)
  const merchantResult = matchMerchantMap(cleaned)
  if (merchantResult) return merchantResult

  // 4. Statement credit detection — negative amount + specific credit keywords
  //    Only fires if no merchant/Plaid match. Uses specific keywords to avoid
  //    false positives on ACH transactions containing "CREDIT".
  if (tx.amount != null && tx.amount < 0) {
    const creditKeywords = [
      "STATEMENT CREDIT", "REWARD", "CASHBACK", "REBATE",
      "COURTESY", "PROMO", "ADJUSTMENT",
    ]
    if (creditKeywords.some((k) => cleaned.toUpperCase().includes(k))) {
      return { category: "Fees & Charges", subcategory: "Statement Credit" }
    }
  }

  // 5. Keyword matching
  const keywordResult = matchKeywords(cleaned)
  if (keywordResult) return keywordResult

  // 6. Fallback
  return { category: "Uncategorized", subcategory: null }
}

/**
 * Shared WHERE clause for uncategorized transaction queries.
 * Must be used in all routes that count or fetch uncategorized transactions
 * to prevent count mismatches between dashboard and categorize pages.
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
 * Generate ranked category suggestions from ALL cascade sources (no short-circuit).
 * Returns 3-5 deduplicated suggestions ordered by confidence.
 * If fewer than 3 from cascade, pads with user's top-used categories.
 */
export function suggestCategories(
  tx: { merchantName: string; rawName: string; plaidCategory?: string | null; amount?: number },
  userRules: CategoryRule[],
  correctionHistory?: Map<string, string>,
  topUsedCategories?: string[]
): CategorySuggestion[] {
  const cleaned = cleanMerchantName(tx.merchantName || tx.rawName)
  const suggestions: CategorySuggestion[] = []

  // 1. User rules
  const ruleResult = applyCategoryRules(cleaned, userRules)
  if (ruleResult) {
    suggestions.push({ ...ruleResult, source: "rule", confidence: "high" })
  }

  // 2. Plaid category (pipe-separated: "PRIMARY|DETAILED")
  if (tx.plaidCategory) {
    const parts = tx.plaidCategory.split("|").map((s) => s.trim())
    for (const part of [...parts].reverse()) {
      if (part && PLAID_CATEGORY_MAP[part]) {
        suggestions.push({ ...PLAID_CATEGORY_MAP[part], source: "plaid", confidence: "medium" })
        break
      }
    }
  }

  // 3. Merchant map (exact then partial)
  const merchantResult = matchMerchantMap(cleaned)
  if (merchantResult) {
    const upper = cleaned.toUpperCase()
    const isExact = !!MERCHANT_MAP[upper]
    suggestions.push({ ...merchantResult, source: "merchant_map", confidence: isExact ? "high" : "medium" })
  }

  // 4. Keyword match
  const keywordResult = matchKeywords(cleaned)
  if (keywordResult) {
    suggestions.push({ ...keywordResult, source: "keyword", confidence: "low" })
  }

  // 5. Correction history
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

  // Pad with top-used categories if fewer than 3 suggestions
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
