/**
 * Prompt builder for AI audit of existing transaction categorizations.
 * Sends only anonymized merchant names — no PII, IDs, or exact amounts.
 */

import { CATEGORIES } from "./categorize"

export interface AuditMerchant {
  name: string
  currentCategory: string
  amountRange: "micro" | "small" | "medium" | "large"
  frequency: number
  isCredit: boolean
}

export interface AIAuditResult {
  merchantName: string
  currentCategory: string
  suggestedCategory: string
  suggestedSubcategory: string | null
  confidence: "high" | "medium" | "low"
  reasoning: string
}

/**
 * Build the audit prompt asking AI to review existing categorizations.
 */
export function buildAuditPrompt(merchants: AuditMerchant[]): string {
  const validCategories = Object.keys(CATEGORIES).filter((c) => c !== "Uncategorized")
  const subcategoryList = Object.entries(CATEGORIES)
    .filter(([k]) => k !== "Uncategorized")
    .map(([cat, subs]) => `  ${cat}: ${(subs as readonly string[]).length > 0 ? (subs as readonly string[]).join(", ") : "(no subcategories)"}`)
    .join("\n")

  const merchantList = merchants
    .map((m) => `  - "${m.name}" → currently "${m.currentCategory}" (avg: ${m.amountRange}, ${m.frequency} tx, ${m.isCredit ? "credit" : "debit"})`)
    .join("\n")

  return `You are a financial transaction categorization auditor. Review the following merchant-to-category assignments and flag any that appear incorrect.

## Valid Categories and Subcategories
${subcategoryList}

## Current Categorizations to Audit
${merchantList}

## Common Mistakes to Look For
- Refunds from known merchants categorized as "Fees & Charges" instead of "Income / Refund"
- Income transactions categorized as transfers or fees
- Known retailers categorized as the wrong merchant type
- Credits/refunds from stores miscategorized as statement credits
- ACH transfers categorized as fees

## Instructions
- Only flag merchants that are INCORRECTLY categorized. Skip correct ones.
- For each flagged merchant, provide the correct category and subcategory.
- Use "high" confidence when you are certain about the correction.
- Use "medium" for reasonable corrections and "low" when unsure.
- Keep reasoning brief (5-10 words).
- If all categorizations look correct, return an empty array.

## Response Format
Return a JSON array (no markdown, no code blocks, just raw JSON):
${JSON.stringify([{
    merchantName: "EXAMPLE STORE",
    currentCategory: "Fees & Charges",
    suggestedCategory: "Shopping",
    suggestedSubcategory: "Department Store",
    confidence: "high",
    reasoning: "Known retailer, not a fee",
  }], null, 2)}

Return ONLY the JSON array.`
}
