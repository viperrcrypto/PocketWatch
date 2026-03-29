/**
 * AI-powered PDF statement parser.
 * Sends PDF text to the configured AI provider for transaction extraction.
 */

import { callAIProviderRaw, type AIProviderConfig } from "./ai-providers"
import type { ParsedRow } from "./statement-types"

const EXTRACTION_PROMPT = `You are a financial data extraction tool. Extract ALL transactions from this bank/card statement.

Return a JSON array of objects with exactly these fields:
- "date": ISO date string (YYYY-MM-DD)
- "merchant": merchant/payee name exactly as shown
- "amount": number — positive for charges/debits, negative for refunds/credits

Rules:
- Amounts in parentheses like (8.49) are NEGATIVE (refunds/credits)
- $0.00 amounts should be included
- Do NOT skip any transactions
- Do NOT include summary/total rows, only individual transactions
- Date formats vary (DD/MM/YYYY, MM/DD/YYYY, etc.) — normalize all to YYYY-MM-DD
- Return ONLY the JSON array, no explanation or markdown

Statement text:
`

interface RawAITransaction {
  date?: string
  merchant?: string
  amount?: number | string
}

/**
 * Parse a PDF statement using AI extraction.
 * Returns ParsedRow[] compatible with the existing insert pipeline.
 */
export async function parsePDFStatement(
  pdfText: string,
  providerConfig: AIProviderConfig
): Promise<{ rows: ParsedRow[]; errors: string[] }> {
  const prompt = EXTRACTION_PROMPT + pdfText

  const rawResponse = await callAIProviderRaw(providerConfig, prompt)

  // Extract JSON array from response (handles markdown code blocks)
  const jsonMatch = rawResponse.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    return { rows: [], errors: ["AI returned no parseable transaction data"] }
  }

  let parsed: RawAITransaction[]
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    return { rows: [], errors: ["AI response was not valid JSON"] }
  }

  if (!Array.isArray(parsed)) {
    return { rows: [], errors: ["AI response was not an array"] }
  }

  const rows: ParsedRow[] = []
  const errors: string[] = []

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    const rowNum = i + 1

    // Validate date
    if (!item.date || typeof item.date !== "string") {
      errors.push(`Row ${rowNum}: missing or invalid date`)
      continue
    }
    const date = new Date(item.date + "T00:00:00Z")
    if (isNaN(date.getTime())) {
      errors.push(`Row ${rowNum}: unparseable date "${item.date}"`)
      continue
    }

    // Validate merchant
    const merchant = item.merchant?.trim()
    if (!merchant) {
      errors.push(`Row ${rowNum}: missing merchant name`)
      continue
    }

    // Validate amount
    const amount = typeof item.amount === "string"
      ? parseFloat(item.amount.replace(/[$,]/g, ""))
      : item.amount
    if (amount == null || !Number.isFinite(amount)) {
      errors.push(`Row ${rowNum}: invalid amount`)
      continue
    }

    rows.push({ date, name: merchant, amount })
  }

  return { rows, errors }
}
