/**
 * Prompt builder for AI rebuild categorization.
 * Enhanced version that includes user context, transfer/CC rules, and custom categories.
 */

import { CATEGORIES } from "./category-types"

export interface RebuildMerchant {
  name: string
  amountRange: "micro" | "small" | "medium" | "large"
  frequency: number
  isCredit: boolean
  currentCategory: string | null
}

export interface RebuildAIResult {
  merchantName: string
  category: string
  subcategory: string | null
  confidence: "high" | "medium" | "low"
  reasoning: string
  isNewCategory: boolean
}

/**
 * Build merchant list from raw transaction rows.
 */
export function buildRebuildMerchants(
  txRows: Array<{ merchantName: string | null; name: string; amount: number; category: string | null }>
): RebuildMerchant[] {
  const grouped = new Map<string, { total: number; count: number; hasCredit: boolean; category: string | null }>()

  for (const tx of txRows) {
    const name = (tx.merchantName ?? tx.name).trim()
    if (!name) continue
    const existing = grouped.get(name) ?? { total: 0, count: 0, hasCredit: false, category: tx.category }
    grouped.set(name, {
      total: existing.total + Math.abs(tx.amount),
      count: existing.count + 1,
      hasCredit: existing.hasCredit || tx.amount < 0,
      category: existing.category,
    })
  }

  return [...grouped.entries()].map(([name, data]) => {
    const avg = data.total / data.count
    const amountRange: RebuildMerchant["amountRange"] =
      avg < 10 ? "micro" : avg < 50 ? "small" : avg < 200 ? "medium" : "large"
    return { name, amountRange, frequency: data.count, isCredit: data.hasCredit, currentCategory: data.category }
  })
}

/**
 * Build the rebuild prompt — includes user context and hard rule instructions.
 */
export function buildRebuildPrompt(
  merchants: RebuildMerchant[],
  customCategoryLabels: string[],
  existingRules: Array<{ matchValue: string; category: string }>,
  mode: "uncategorized" | "full"
): string {
  const validCategories = Object.keys(CATEGORIES).filter((c) => c !== "Uncategorized")
  const subcategoryList = Object.entries(CATEGORIES)
    .filter(([k]) => k !== "Uncategorized")
    .map(([cat, subs]) => `  ${cat}: ${(subs as readonly string[]).length > 0 ? (subs as readonly string[]).join(", ") : "(no subcategories)"}`)
    .join("\n")

  const customSection = customCategoryLabels.length > 0
    ? `\n## User's Custom Categories\n${customCategoryLabels.map((l) => `  - ${l}`).join("\n")}\n`
    : ""

  const rulesSection = existingRules.length > 0
    ? `\n## User's Established Rules (respect these preferences)\n${existingRules.slice(0, 30).map((r) => `  - "${r.matchValue}" → ${r.category}`).join("\n")}\n`
    : ""

  const merchantList = merchants
    .map((m) => {
      const parts = [`"${m.name}"`, `avg: ${m.amountRange}`, `${m.frequency} tx`, m.isCredit ? "credit" : "debit"]
      if (mode === "full" && m.currentCategory) parts.push(`currently: "${m.currentCategory}"`)
      return `  - ${parts.join(", ")}`
    })
    .join("\n")

  const modeInstructions = mode === "full"
    ? `This is a FULL REBUILD. Review all merchants including already-categorized ones. Fix any miscategorizations.`
    : `Categorize these uncategorized merchants.`

  return `You are a financial transaction categorizer. ${modeInstructions}

## Valid Categories and Subcategories
${subcategoryList}
${customSection}${rulesSection}
## Merchants to Categorize
${merchantList}

## CRITICAL RULES
- Credit card payments (PAYMENT THANK YOU, AUTOPAY, AUTOMATIC PAYMENT, etc.) are ALWAYS "Transfer / Bank Transfer"
- Inter-account transfers (TRANSFER, ACH TRANSFER, WIRE TRANSFER) are ALWAYS "Transfer / Bank Transfer"
- Venmo, Zelle, Cash App, PayPal are "Transfer"
- Direct deposits, payroll, salary are "Income / Salary"
- Refunds from stores are "Income / Refund"
- Do NOT categorize transfers as "Bills & Utilities" or "Fees & Charges"

## Custom Category Rules
- Only suggest a new category if NONE of the ${validCategories.length} built-in categories fit
- Set "isNewCategory": true only for genuinely new categories
- Be very conservative — prefer built-in categories

## Instructions
- Use "high" confidence for well-known brands and obvious matches
- Use "medium" for reasonable but uncertain matches
- Use "low" when guessing
- Keep reasoning brief (5-10 words)
- Set subcategory to null if unsure

## Response Format
Return ONLY a JSON array (no markdown, no code blocks):
${JSON.stringify([{
    merchantName: "EXAMPLE",
    category: "Shopping",
    subcategory: "Online Shopping",
    confidence: "high",
    reasoning: "Major online retailer",
    isNewCategory: false,
  }], null, 2)}

Categorize ALL merchants. Return ONLY the JSON array.`
}

/**
 * Parse AI response into structured results.
 */
export function parseRebuildResponse(raw: string): RebuildAIResult[] {
  const arrayMatch = raw.match(/\[[\s\S]*\]/)
  if (!arrayMatch) return []

  try {
    const parsed = JSON.parse(arrayMatch[0])
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item: unknown): item is RebuildAIResult =>
        typeof item === "object" && item !== null &&
        "merchantName" in item && "category" in item
      )
      .map((item) => ({
        merchantName: String(item.merchantName),
        category: String(item.category),
        subcategory: item.subcategory ? String(item.subcategory) : null,
        confidence: (["high", "medium", "low"].includes(item.confidence) ? item.confidence : "low") as RebuildAIResult["confidence"],
        reasoning: String(item.reasoning ?? ""),
        isNewCategory: Boolean(item.isNewCategory),
      }))
  } catch {
    return []
  }
}
