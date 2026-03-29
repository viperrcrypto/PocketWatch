/**
 * Bank statement CSV parser with auto-detection for major US banks.
 *
 * Supports: Chase, BofA, Amex, Wells Fargo, Capital One, Discover, and generic CSVs.
 * All amounts normalized to: positive = expense/outflow, negative = income/inflow
 * (matching existing Plaid/SimpleFIN convention in the database).
 */

import type { BankFormat, ParsedRow, ParseResult } from "./statement-types"

// ─── CSV Parsing (RFC 4180) ────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ",") {
      fields.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

/**
 * Split CSV text into logical lines, respecting quoted fields that contain newlines.
 * RFC 4180 allows \n inside quoted fields — naive split("\n") would break those.
 */
function splitLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const lines: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      current += ch
    } else if (ch === "\n" && !inQuotes) {
      if (current.trim().length > 0) lines.push(current)
      current = ""
    } else {
      current += ch
    }
  }
  if (current.trim().length > 0) lines.push(current)

  return lines
}

// ─── Date Parsing ──────────────────────────────────────────────

function parseDate(str: string): Date | null {
  const trimmed = str.trim()

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)))
    return isNaN(date.getTime()) ? null : date
  }

  // YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    const [, y, m, d] = isoMatch
    const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)))
    return isNaN(date.getTime()) ? null : date
  }

  // MM-DD-YYYY
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const [, m, d, y] = dashMatch
    const date = new Date(Date.UTC(parseInt(y), parseInt(m) - 1, parseInt(d)))
    return isNaN(date.getTime()) ? null : date
  }

  return null
}

function parseAmount(str: string): number | null {
  const cleaned = str.replace(/[$,\s"]/g, "").trim()
  if (cleaned === "" || cleaned === "--") return null
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

// ─── Format Detection ──────────────────────────────────────────

interface FormatSignature {
  format: BankFormat
  required: string[]
  forbidden?: string[]
}

const FORMAT_SIGNATURES: FormatSignature[] = [
  {
    format: "chase",
    required: ["transaction date", "post date", "description", "amount"],
  },
  {
    format: "capital_one",
    required: ["transaction date", "posted date", "card no.", "description", "debit", "credit"],
  },
  {
    format: "discover",
    required: ["trans. date", "post date", "description", "amount", "category"],
  },
  {
    format: "bofa",
    required: ["date", "description", "amount", "running bal."],
  },
  {
    format: "amex",
    required: ["date", "description", "amount"],
    forbidden: ["running bal.", "post date", "posted date"],
  },
]

export function detectFormat(headers: string[]): BankFormat {
  const normalized = headers.map((h) => h.toLowerCase().trim())

  for (const sig of FORMAT_SIGNATURES) {
    const hasAll = sig.required.every((req) =>
      normalized.some((h) => h.includes(req))
    )
    const hasForbidden = sig.forbidden?.some((f) =>
      normalized.some((h) => h.includes(f))
    ) ?? false

    if (hasAll && !hasForbidden) return sig.format
  }

  // Wells Fargo: often no header row, exactly 5 columns
  if (normalized.length === 5 && normalized[0] === "" && normalized[1] === "") {
    return "wells_fargo"
  }

  return "generic"
}

// ─── Format-Specific Extractors ────────────────────────────────

interface ColumnExtractor {
  dateCol: number
  nameCol: number
  amountCol?: number
  debitCol?: number
  creditCol?: number
  checkCol?: number
  negate: boolean // true = negate the raw amount (bank uses negative = expense)
}

function findColumn(headers: string[], ...candidates: string[]): number {
  const normalized = headers.map((h) => h.toLowerCase().trim())
  for (const candidate of candidates) {
    const idx = normalized.findIndex((h) => h.includes(candidate))
    if (idx >= 0) return idx
  }
  return -1
}

function getExtractor(format: BankFormat, headers: string[]): ColumnExtractor {
  switch (format) {
    case "chase":
      return {
        dateCol: findColumn(headers, "transaction date"),
        nameCol: findColumn(headers, "description"),
        amountCol: findColumn(headers, "amount"),
        negate: true, // Chase: negative = expense → negate to positive
      }

    case "bofa":
      return {
        dateCol: findColumn(headers, "date"),
        nameCol: findColumn(headers, "description"),
        amountCol: findColumn(headers, "amount"),
        negate: true,
      }

    case "amex":
      return {
        dateCol: findColumn(headers, "date"),
        nameCol: findColumn(headers, "description"),
        amountCol: findColumn(headers, "amount"),
        negate: false, // Amex: positive = charge (already expense convention)
      }

    case "wells_fargo":
      return {
        dateCol: 0,
        nameCol: 4,
        amountCol: 1,
        negate: true,
      }

    case "capital_one":
      return {
        dateCol: findColumn(headers, "transaction date"),
        nameCol: findColumn(headers, "description"),
        debitCol: findColumn(headers, "debit"),
        creditCol: findColumn(headers, "credit"),
        negate: false,
      }

    case "discover":
      return {
        dateCol: findColumn(headers, "trans. date"),
        nameCol: findColumn(headers, "description"),
        amountCol: findColumn(headers, "amount"),
        negate: true,
      }

    case "generic":
    default:
      return getGenericExtractor(headers)
  }
}

function getGenericExtractor(headers: string[]): ColumnExtractor {
  const dateCol = findColumn(headers, "date", "transaction date", "trans date", "posted")
  const nameCol = findColumn(headers, "description", "memo", "name", "payee", "merchant")
  const amountCol = findColumn(headers, "amount")
  const debitCol = findColumn(headers, "debit", "withdrawal")
  const creditCol = findColumn(headers, "credit", "deposit")

  if (debitCol >= 0 && creditCol >= 0) {
    return { dateCol, nameCol, debitCol, creditCol, negate: false }
  }

  return { dateCol, nameCol, amountCol: amountCol >= 0 ? amountCol : -1, negate: true }
}

function extractRow(fields: string[], extractor: ColumnExtractor): ParsedRow | null {
  if (extractor.dateCol < 0 || extractor.nameCol < 0) return null

  const dateStr = fields[extractor.dateCol]
  if (!dateStr) return null

  const date = parseDate(dateStr)
  if (!date) return null

  const name = fields[extractor.nameCol]?.trim()
  if (!name) return null

  let amount: number | null = null

  if (extractor.debitCol != null && extractor.creditCol != null) {
    const debit = parseAmount(fields[extractor.debitCol] ?? "")
    const credit = parseAmount(fields[extractor.creditCol] ?? "")
    // debit = expense (positive), credit = income (negative)
    if (debit != null && debit !== 0) {
      amount = debit
    } else if (credit != null && credit !== 0) {
      amount = -credit
    } else {
      amount = 0
    }
  } else if (extractor.amountCol != null && extractor.amountCol >= 0) {
    const raw = parseAmount(fields[extractor.amountCol] ?? "")
    if (raw == null) return null
    amount = extractor.negate ? -raw : raw
  }

  if (amount == null) return null

  const checkNumber = extractor.checkCol != null && extractor.checkCol >= 0
    ? fields[extractor.checkCol]?.trim() || undefined
    : undefined

  return { date, name, amount, checkNumber }
}

// ─── Main Parser ───────────────────────────────────────────────

export function parseStatement(csvText: string): ParseResult {
  const lines = splitLines(csvText)
  if (lines.length < 2) {
    return { format: "generic", rows: [], errors: ["File is empty or has no data rows"], headerRow: [] }
  }

  const headerRow = parseCSVLine(lines[0])
  const format = detectFormat(headerRow)

  // Wells Fargo sometimes has no header — first row is data
  const isHeaderless = format === "wells_fargo" && parseDate(headerRow[0]?.trim() ?? "") !== null
  const dataStartIndex = isHeaderless ? 0 : 1
  const effectiveHeaders = isHeaderless ? ["Date", "Amount", "", "", "Description"] : headerRow

  const extractor = getExtractor(format, effectiveHeaders)
  const rows: ParsedRow[] = []
  const errors: string[] = []

  for (let i = dataStartIndex; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.every((f) => f === "")) continue

    const row = extractRow(fields, extractor)
    if (row) {
      rows.push(row)
    } else {
      errors.push(`Row ${i + 1}: could not parse`)
    }
  }

  return { format, rows, errors, headerRow: effectiveHeaders }
}

// ─── Client-Side Preview ───────────────────────────────────────

export function previewStatement(
  csvText: string,
  maxRows = 5
): { format: BankFormat; rows: ParsedRow[]; headerRow: string[]; totalLines: number } {
  const lines = splitLines(csvText)
  if (lines.length < 2) {
    return { format: "generic", rows: [], headerRow: [], totalLines: 0 }
  }

  const headerRow = parseCSVLine(lines[0])
  const format = detectFormat(headerRow)
  const isHeaderless = format === "wells_fargo" && parseDate(headerRow[0]?.trim() ?? "") !== null
  const dataStartIndex = isHeaderless ? 0 : 1
  const effectiveHeaders = isHeaderless ? ["Date", "Amount", "", "", "Description"] : headerRow
  const extractor = getExtractor(format, effectiveHeaders)

  const rows: ParsedRow[] = []
  for (let i = dataStartIndex; i < lines.length && rows.length < maxRows; i++) {
    const fields = parseCSVLine(lines[i])
    if (fields.every((f) => f === "")) continue
    const row = extractRow(fields, extractor)
    if (row) rows.push(row)
  }

  return {
    format,
    rows,
    headerRow: effectiveHeaders,
    totalLines: lines.length - dataStartIndex,
  }
}

/** Human-readable label for detected bank format */
export const FORMAT_LABELS: Record<BankFormat, string> = {
  chase: "Chase",
  bofa: "Bank of America",
  amex: "American Express",
  wells_fargo: "Wells Fargo",
  capital_one: "Capital One",
  discover: "Discover",
  generic: "Generic CSV",
  ai_pdf: "AI-Parsed PDF",
}
