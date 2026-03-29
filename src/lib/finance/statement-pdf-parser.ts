/**
 * AI-powered PDF statement parser.
 * Sends PDF text to the configured AI provider for transaction extraction.
 * Also handles file-level PDF processing (text extraction, provider resolution).
 */

import { callAIProviderRaw, type AIProviderConfig, type AIProviderType } from "./ai-providers"
import { db } from "@/lib/db"
import { decryptCredential } from "./crypto"
import type { ParsedRow } from "./statement-types"

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

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

    // Validate date — try ISO first, then common formats
    if (!item.date || typeof item.date !== "string") {
      errors.push(`Row ${rowNum}: missing or invalid date`)
      continue
    }
    let date = new Date(item.date + "T00:00:00Z")
    if (isNaN(date.getTime())) {
      // Try M/D/YYYY or D/M/YYYY fallback
      const parts = item.date.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
      if (parts) {
        const [, a, b, year] = parts
        const month = parseInt(a) <= 12 ? parseInt(a) : parseInt(b)
        const day = parseInt(a) <= 12 ? parseInt(b) : parseInt(a)
        date = new Date(Date.UTC(parseInt(year), month - 1, day))
      }
      if (isNaN(date.getTime())) {
        errors.push(`Row ${rowNum}: unparseable date "${item.date}"`)
        continue
      }
    }
    // Validate date is in reasonable range (1990-2030)
    const year = date.getUTCFullYear()
    if (year < 1990 || year > 2030) {
      errors.push(`Row ${rowNum}: date "${item.date}" is out of range (${year})`)
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

  // Warn if all amounts have unexpected sign distribution
  if (rows.length >= 5) {
    const positiveCount = rows.filter((r) => r.amount > 0).length
    const ratio = positiveCount / rows.length
    // Expect mostly positive (charges). If >90% negative, signs may be reversed.
    if (ratio < 0.1) {
      errors.push("Warning: most amounts are negative — amounts may have reversed signs. Positive = charges, negative = refunds.")
    }
  }

  return { rows, errors }
}

/**
 * Full PDF pipeline: extract text → resolve AI provider → parse with AI.
 * Returns structured errors instead of throwing, so all failure modes reach the user.
 */
export async function parsePDFFromFile(
  file: File,
  userId: string
): Promise<{ rows: ParsedRow[]; errors: string[] }> {
  // 1. Extract text from PDF using pdfjs-dist directly (pdf-parse v2 has worker issues in Next.js)
  let text: string
  try {
    const { extractTextFromPDF } = await import("./pdf-text-extract")
    text = await extractTextFromPDF(new Uint8Array(await file.arrayBuffer()))
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown PDF error"
    if (msg.includes("password")) {
      return { rows: [], errors: ["PDF is password-protected — please remove the password and re-upload"] }
    }
    return { rows: [], errors: [`Failed to read PDF: ${msg}`] }
  }

  if (!text || text.trim().length < 20) {
    return { rows: [], errors: ["Could not extract text from PDF — the file may be image-only or scanned. Please upload a text-based PDF or use CSV instead."] }
  }

  // 2. Resolve AI provider
  let providerConfig: AIProviderConfig
  try {
    const providerKey = await db.externalApiKey.findFirst({
      where: { userId, serviceName: { in: AI_SERVICES }, verified: true },
      orderBy: { updatedAt: "desc" },
    })

    providerConfig = providerKey
      ? {
          provider: providerKey.serviceName as AIProviderType,
          apiKey: await decryptCredential(providerKey.apiKeyEnc),
          model: providerKey.model ?? undefined,
        }
      : {
          provider: "ai_claude_cli" as AIProviderType,
          apiKey: "enabled",
          model: undefined,
        }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { rows: [], errors: [`AI provider configuration error: ${msg}. Check your API keys in Settings.`] }
  }

  // 3. Parse with AI
  try {
    return await parsePDFStatement(text, providerConfig)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown AI error"
    if (msg.includes("not found") || msg.includes("ENOENT")) {
      return { rows: [], errors: ["AI parser unavailable — configure an AI API key in Settings, or upload a CSV instead"] }
    }
    if (msg.includes("401") || msg.includes("Unauthorized") || msg.includes("invalid")) {
      return { rows: [], errors: [`AI API key rejected: ${msg}. Update your API key in Settings.`] }
    }
    if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("aborted")) {
      return { rows: [], errors: ["AI parsing timed out — the PDF may be too large. Try splitting it or using CSV."] }
    }
    return { rows: [], errors: [`AI parsing failed: ${msg}`] }
  }
}
