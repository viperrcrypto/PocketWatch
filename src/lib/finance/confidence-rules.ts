/**
 * Confidence-based category rule engine.
 * Rules have numeric confidence (0.0–1.0) that increases on user confirmation
 * and decreases on override. High-confidence rules auto-apply silently.
 */

import type { CategoryResult } from "./category-types"

// ─── Thresholds ────────────────────────────────────────────────

export const CONFIDENCE = {
  /** Rules at or above this auto-apply without review */
  AUTO_APPLY: 0.8,
  /** Rules below this are disabled (don't fire) */
  DISABLED: 0.5,
  /** Initial confidence for user-created rules */
  INITIAL_USER: 0.7,
  /** Initial confidence for AI-created rules */
  INITIAL_AI: 0.6,
  /** Bump on user confirmation */
  CONFIRM_BUMP: 0.1,
  /** Penalty on user override */
  OVERRIDE_PENALTY: 0.2,
  /** Maximum confidence */
  MAX: 1.0,
  /** Minimum confidence */
  MIN: 0.0,
} as const

// ─── Types ─────────────────────────────────────────────────────

export interface ConfidenceRule {
  id: string
  matchType: string
  matchValue: string
  category: string
  subcategory: string | null
  priority: number
  confidence: number
  timesConfirmed: number
  timesOverridden: number
}

export interface ConfidenceRuleMatch {
  result: CategoryResult
  rule: ConfidenceRule
  needsReview: boolean
}

// ─── Pure Functions ────────────────────────────────────────────

/**
 * Filter and sort rules for the cascade.
 * Excludes disabled rules (<0.5), sorts by confidence desc then priority desc.
 */
export function buildConfidenceRuleSet(rules: ConfidenceRule[]): ConfidenceRule[] {
  return [...rules]
    .filter((r) => r.confidence >= CONFIDENCE.DISABLED)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return b.priority - a.priority
    })
}

/**
 * Apply confidence-gated rules to a merchant name.
 * Returns the match with review status, or null if no rule fires.
 */
export function applyConfidenceRules(
  merchantName: string,
  rules: ConfidenceRule[]
): ConfidenceRuleMatch | null {
  const sorted = buildConfidenceRuleSet(rules)
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
      return {
        result: { category: rule.category, subcategory: rule.subcategory },
        rule,
        needsReview: rule.confidence < CONFIDENCE.AUTO_APPLY,
      }
    }
  }

  return null
}

/**
 * Compute new confidence after a feedback event.
 */
export function computeNewConfidence(
  current: number,
  event: "confirmed" | "overridden"
): number {
  if (event === "confirmed") {
    return Math.min(current + CONFIDENCE.CONFIRM_BUMP, CONFIDENCE.MAX)
  }
  return Math.max(current - CONFIDENCE.OVERRIDE_PENALTY, CONFIDENCE.MIN)
}

/**
 * Determine if a rule's confidence means it should auto-apply without review.
 */
export function isAutoApplyConfidence(confidence: number): boolean {
  return confidence >= CONFIDENCE.AUTO_APPLY
}

/**
 * Determine if a rule's confidence means it's in the review band.
 */
export function isReviewConfidence(confidence: number): boolean {
  return confidence >= CONFIDENCE.DISABLED && confidence < CONFIDENCE.AUTO_APPLY
}
