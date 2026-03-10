/**
 * Prompt builder for AI-powered transaction categorization.
 * Sends only anonymized merchant names — no PII, IDs, or exact amounts.
 */

import { CATEGORIES } from "./categorize"

export interface AnonymizedMerchant {
  name: string
  amountRange: "micro" | "small" | "medium" | "large"
  frequency: number
}

export interface AICategorizeResult {
  merchantName: string
  category: string
  subcategory: string | null
  confidence: "high" | "medium" | "low"
  reasoning: string
}

/**
 * Build anonymized merchant list from raw transactions.
 * Groups by cleaned merchant name, buckets amounts, counts frequency.
 */
export function buildAnonymizedMerchantsForCategorization(
  transactions: Array<{ merchantName: string | null; name: string; amount: number }>
): AnonymizedMerchant[] {
  const grouped = new Map<string, { total: number; count: number }>()

  for (const tx of transactions) {
    const name = (tx.merchantName ?? tx.name).trim()
    if (!name) continue
    const existing = grouped.get(name) ?? { total: 0, count: 0 }
    grouped.set(name, {
      total: existing.total + Math.abs(tx.amount),
      count: existing.count + 1,
    })
  }

  return [...grouped.entries()].map(([name, data]) => {
    const avg = data.total / data.count
    const amountRange: AnonymizedMerchant["amountRange"] =
      avg < 10 ? "micro" :
      avg < 50 ? "small" :
      avg < 200 ? "medium" : "large"

    return { name, amountRange, frequency: data.count }
  })
}

/**
 * Build the categorization prompt.
 * Only contains: merchant names, bucketed amount ranges, frequency counts.
 * NEVER contains: transaction IDs, account IDs, user IDs, exact dates, exact amounts.
 */
export function buildCategorizationPrompt(merchants: AnonymizedMerchant[]): string {
  const validCategories = Object.keys(CATEGORIES).filter((c) => c !== "Uncategorized")
  const subcategoryList = Object.entries(CATEGORIES)
    .filter(([k]) => k !== "Uncategorized")
    .map(([cat, subs]) => `  ${cat}: ${(subs as readonly string[]).length > 0 ? (subs as readonly string[]).join(", ") : "(no subcategories)"}`)
    .join("\n")

  const merchantList = merchants
    .map((m) => `  - "${m.name}" (avg amount: ${m.amountRange}, ${m.frequency} transaction${m.frequency > 1 ? "s" : ""})`)
    .join("\n")

  return `You are a financial transaction categorizer. Categorize the following merchants into the correct spending categories.

## Valid Categories and Subcategories
${subcategoryList}

## Merchants to Categorize
${merchantList}

## Instructions
- For each merchant, determine the most likely category and subcategory based on the merchant name and amount range.
- Use "low" confidence when uncertain about a categorization.
- Use "high" confidence for well-known brands and obvious matches.
- Use "medium" confidence for reasonable but not certain matches.
- Set subcategory to null if unsure which subcategory applies.
- Keep reasoning very brief (5-10 words).

## Response Format
Return a JSON array (no markdown, no code blocks, just raw JSON):
${JSON.stringify([{
    merchantName: "EXAMPLE STORE",
    category: "Shopping",
    subcategory: "Online Shopping",
    confidence: "high",
    reasoning: "Major online retailer",
  }], null, 2)}

Categorize ALL merchants. Return ONLY the JSON array.`
}
