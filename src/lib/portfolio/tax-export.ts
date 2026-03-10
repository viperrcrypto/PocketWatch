/**
 * Tax export library — pure functions for IRS form generation.
 *
 * Generates Form 8949, Schedule D, TurboTax CSV, generic CSV, and tax estimates
 * using 2025 IRS brackets and digital asset box codes (G/H/I, J/K/L).
 */

// ─── Types ───

export type ExportFormat = "form8949" | "schedule_d" | "turbotax" | "csv"
export type Form8949Box = "G" | "H" | "I" | "J" | "K" | "L"

export interface TaxGainEntry {
  symbol: string
  quantity: number
  acquiredAt: Date | null
  acquiredAtVarious: boolean
  disposedAt: Date
  proceedsUsd: number
  costBasisUsd: number
  gainUsd: number
  holdingPeriod: number
  isLongTerm: boolean
  costBasisMethod: string
  form8949Box: Form8949Box
  walletAddress: string
}

export interface ScheduleDSummary {
  // Part I — Short-Term
  line1b: { proceeds: number; costBasis: number; gainLoss: number } // Box G
  line2: { proceeds: number; costBasis: number; gainLoss: number }  // Box H
  line3: { proceeds: number; costBasis: number; gainLoss: number }  // Box I
  shortTermTotal: number
  // Part II — Long-Term
  line8b: { proceeds: number; costBasis: number; gainLoss: number } // Box J
  line9: { proceeds: number; costBasis: number; gainLoss: number }  // Box K
  line10: { proceeds: number; costBasis: number; gainLoss: number } // Box L
  longTermTotal: number
  // Combined
  netGainLoss: number
}

export interface TaxEstimate {
  shortTermTax: number
  longTermTax: number
  niit: number
  totalEstimatedTax: number
  effectiveRate: number
  marginalRates: { shortTerm: number; longTerm: number }
}

// ─── 2025 Tax Brackets ───

interface TaxBracket {
  min: number
  max: number
  rate: number
}

const ORDINARY_BRACKETS_2025: TaxBracket[] = [
  { min: 0, max: 11_925, rate: 0.10 },
  { min: 11_925, max: 48_475, rate: 0.12 },
  { min: 48_475, max: 103_350, rate: 0.22 },
  { min: 103_350, max: 197_300, rate: 0.24 },
  { min: 197_300, max: 250_525, rate: 0.32 },
  { min: 250_525, max: 626_350, rate: 0.35 },
  { min: 626_350, max: Infinity, rate: 0.37 },
]

const LTCG_BRACKETS_2025: TaxBracket[] = [
  { min: 0, max: 48_350, rate: 0.00 },
  { min: 48_350, max: 533_400, rate: 0.15 },
  { min: 533_400, max: Infinity, rate: 0.20 },
]

const NIIT_THRESHOLD_SINGLE = 200_000
const NIIT_RATE = 0.038

// ─── Helpers ───

function formatIrsDate(d: Date): string {
  const month = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  const year = d.getUTCFullYear()
  return `${month}/${day}/${year}`
}

function formatIrsDollar(amount: number): string {
  if (amount < 0) return `(${Math.abs(amount).toFixed(2)})`
  return amount.toFixed(2)
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function calcBracketTax(income: number, brackets: TaxBracket[]): { tax: number; marginalRate: number } {
  let tax = 0
  let marginalRate = 0
  for (const bracket of brackets) {
    if (income <= bracket.min) break
    const taxable = Math.min(income, bracket.max) - bracket.min
    tax += taxable * bracket.rate
    marginalRate = bracket.rate
  }
  return { tax, marginalRate }
}

/** Apply bracket rates starting from a given income offset (for stacking LTCG on top of ordinary income). */
function calcBracketTaxFrom(income: number, brackets: TaxBracket[], startFrom: number): { tax: number; marginalRate: number } {
  let tax = 0
  let marginalRate = 0
  const effectiveIncome = startFrom + income
  for (const bracket of brackets) {
    if (effectiveIncome <= bracket.min) break
    if (startFrom >= bracket.max) continue
    const low = Math.max(bracket.min, startFrom)
    const high = Math.min(effectiveIncome, bracket.max)
    const taxable = high - low
    if (taxable > 0) {
      tax += taxable * bracket.rate
      marginalRate = bracket.rate
    }
  }
  return { tax, marginalRate }
}

function sumByBox(entries: TaxGainEntry[], box: Form8949Box) {
  const filtered = entries.filter((e) => e.form8949Box === box)
  return {
    proceeds: filtered.reduce((s, e) => s + e.proceedsUsd, 0),
    costBasis: filtered.reduce((s, e) => s + e.costBasisUsd, 0),
    gainLoss: filtered.reduce((s, e) => s + e.gainUsd, 0),
  }
}

// ─── Form 8949 CSV ───

export function generateForm8949Csv(entries: TaxGainEntry[]): string {
  const lines: string[] = []

  const shortTerm = entries.filter((e) => !e.isLongTerm)
  const longTerm = entries.filter((e) => e.isLongTerm)

  const stBoxes: Form8949Box[] = ["G", "H", "I"]
  const ltBoxes: Form8949Box[] = ["J", "K", "L"]

  // Header
  lines.push("Form 8949 - Sales and Other Dispositions of Capital Assets (Digital Assets)")
  lines.push("")

  // Part I — Short-Term
  lines.push("Part I - Short-Term Capital Gains and Losses (Digital Assets held one year or less)")
  lines.push("")

  for (const box of stBoxes) {
    const boxEntries = shortTerm.filter((e) => e.form8949Box === box)
    if (boxEntries.length === 0) continue

    lines.push(`Box ${box}`)
    lines.push("(a) Description of property,(b) Date acquired,(c) Date sold or disposed of,(d) Proceeds,(e) Cost or other basis,(f) Code,(g) Adjustment,(h) Gain or (loss)")

    for (const e of boxEntries) {
      const desc = `${e.quantity.toFixed(6)} ${e.symbol}`
      const acquired = e.acquiredAtVarious ? "VARIOUS" : e.acquiredAt ? formatIrsDate(e.acquiredAt) : ""
      const disposed = formatIrsDate(e.disposedAt)
      lines.push(
        [
          escapeCsvField(desc),
          acquired,
          disposed,
          formatIrsDollar(e.proceedsUsd),
          formatIrsDollar(e.costBasisUsd),
          "",
          "0.00",
          formatIrsDollar(e.gainUsd),
        ].join(",")
      )
    }

    const totals = sumByBox(entries, box)
    lines.push(`Box ${box} Totals,,,${formatIrsDollar(totals.proceeds)},${formatIrsDollar(totals.costBasis)},,0.00,${formatIrsDollar(totals.gainLoss)}`)
    lines.push("")
  }

  // Part II — Long-Term
  lines.push("Part II - Long-Term Capital Gains and Losses (Digital Assets held more than one year)")
  lines.push("")

  for (const box of ltBoxes) {
    const boxEntries = longTerm.filter((e) => e.form8949Box === box)
    if (boxEntries.length === 0) continue

    lines.push(`Box ${box}`)
    lines.push("(a) Description of property,(b) Date acquired,(c) Date sold or disposed of,(d) Proceeds,(e) Cost or other basis,(f) Code,(g) Adjustment,(h) Gain or (loss)")

    for (const e of boxEntries) {
      const desc = `${e.quantity.toFixed(6)} ${e.symbol}`
      const acquired = e.acquiredAtVarious ? "VARIOUS" : e.acquiredAt ? formatIrsDate(e.acquiredAt) : ""
      const disposed = formatIrsDate(e.disposedAt)
      lines.push(
        [
          escapeCsvField(desc),
          acquired,
          disposed,
          formatIrsDollar(e.proceedsUsd),
          formatIrsDollar(e.costBasisUsd),
          "",
          "0.00",
          formatIrsDollar(e.gainUsd),
        ].join(",")
      )
    }

    const totals = sumByBox(entries, box)
    lines.push(`Box ${box} Totals,,,${formatIrsDollar(totals.proceeds)},${formatIrsDollar(totals.costBasis)},,0.00,${formatIrsDollar(totals.gainLoss)}`)
    lines.push("")
  }

  return lines.join("\n")
}

// ─── Schedule D Summary ───

export function generateScheduleD(entries: TaxGainEntry[]): ScheduleDSummary {
  const line1b = sumByBox(entries, "G")
  const line2 = sumByBox(entries, "H")
  const line3 = sumByBox(entries, "I")
  const shortTermTotal = line1b.gainLoss + line2.gainLoss + line3.gainLoss

  const line8b = sumByBox(entries, "J")
  const line9 = sumByBox(entries, "K")
  const line10 = sumByBox(entries, "L")
  const longTermTotal = line8b.gainLoss + line9.gainLoss + line10.gainLoss

  return {
    line1b,
    line2,
    line3,
    shortTermTotal,
    line8b,
    line9,
    line10,
    longTermTotal,
    netGainLoss: shortTermTotal + longTermTotal,
  }
}

// ─── Schedule D CSV ───

export function generateScheduleDCsv(summary: ScheduleDSummary, taxYear: string): string {
  const lines: string[] = []
  const f = formatIrsDollar

  lines.push(`Schedule D Summary - Capital Gains and Losses (Digital Assets) - Tax Year ${taxYear}`)
  lines.push("")
  lines.push("Part I - Short-Term Capital Gains and Losses,,Proceeds,Cost Basis,Gain/Loss")
  lines.push(`Line 1b (Box G),,${f(summary.line1b.proceeds)},${f(summary.line1b.costBasis)},${f(summary.line1b.gainLoss)}`)
  lines.push(`Line 2 (Box H),,${f(summary.line2.proceeds)},${f(summary.line2.costBasis)},${f(summary.line2.gainLoss)}`)
  lines.push(`Line 3 (Box I),,${f(summary.line3.proceeds)},${f(summary.line3.costBasis)},${f(summary.line3.gainLoss)}`)
  lines.push(`Short-Term Total,,${f(summary.line1b.proceeds + summary.line2.proceeds + summary.line3.proceeds)},${f(summary.line1b.costBasis + summary.line2.costBasis + summary.line3.costBasis)},${f(summary.shortTermTotal)}`)
  lines.push("")
  lines.push("Part II - Long-Term Capital Gains and Losses,,Proceeds,Cost Basis,Gain/Loss")
  lines.push(`Line 8b (Box J),,${f(summary.line8b.proceeds)},${f(summary.line8b.costBasis)},${f(summary.line8b.gainLoss)}`)
  lines.push(`Line 9 (Box K),,${f(summary.line9.proceeds)},${f(summary.line9.costBasis)},${f(summary.line9.gainLoss)}`)
  lines.push(`Line 10 (Box L),,${f(summary.line10.proceeds)},${f(summary.line10.costBasis)},${f(summary.line10.gainLoss)}`)
  lines.push(`Long-Term Total,,${f(summary.line8b.proceeds + summary.line9.proceeds + summary.line10.proceeds)},${f(summary.line8b.costBasis + summary.line9.costBasis + summary.line10.costBasis)},${f(summary.longTermTotal)}`)
  lines.push("")
  lines.push(`Net Capital Gain/Loss,,,,${f(summary.netGainLoss)}`)

  return lines.join("\n")
}

// ─── TurboTax CSV ───

export function generateTurboTaxCsv(entries: TaxGainEntry[]): string {
  const lines: string[] = [
    "Currency Name,Purchase Date,Cost Basis,Date Sold,Proceeds",
  ]

  for (const e of entries) {
    const purchaseDate = e.acquiredAtVarious
      ? "VARIOUS"
      : e.acquiredAt
        ? formatIrsDate(e.acquiredAt)
        : ""
    lines.push(
      [
        escapeCsvField(e.symbol),
        purchaseDate,
        e.costBasisUsd.toFixed(2),
        formatIrsDate(e.disposedAt),
        e.proceedsUsd.toFixed(2),
      ].join(",")
    )
  }

  return lines.join("\n")
}

// ─── Generic CSV (Enhanced) ───

export function generateGenericCsv(entries: TaxGainEntry[]): string {
  const lines: string[] = [
    "Date Sold,Date Acquired,Asset,Qty,Proceeds,Cost Basis,Gain/Loss,Holding Period,Type,Method,Wallet,Form 8949 Box",
  ]

  for (const e of entries) {
    const acquired = e.acquiredAtVarious
      ? "VARIOUS"
      : e.acquiredAt
        ? formatIrsDate(e.acquiredAt)
        : ""
    lines.push(
      [
        formatIrsDate(e.disposedAt),
        acquired,
        e.symbol,
        e.quantity.toFixed(6),
        e.proceedsUsd.toFixed(2),
        e.costBasisUsd.toFixed(2),
        e.gainUsd.toFixed(2),
        `${e.holdingPeriod}d`,
        e.isLongTerm ? "Long-Term" : "Short-Term",
        e.costBasisMethod,
        e.walletAddress,
        e.form8949Box,
      ].join(",")
    )
  }

  return lines.join("\n")
}

// ─── Tax Liability Estimator (2025 Brackets) ───

export function estimateTaxLiability(
  shortTermGain: number,
  longTermGain: number,
  taxableIncome?: number,
): TaxEstimate {
  // Use short-term gain as proxy for total income if not provided
  const ordinaryIncome = taxableIncome ?? Math.max(0, shortTermGain)
  const totalInvestmentIncome = Math.max(0, shortTermGain) + Math.max(0, longTermGain)

  // Short-term gains are taxed at ordinary income rates
  const stResult = calcBracketTax(Math.max(0, ordinaryIncome), ORDINARY_BRACKETS_2025)
  const shortTermTax = shortTermGain > 0 ? stResult.tax : 0

  // Long-term gains are taxed at LTCG rates, stacked on top of ordinary income
  const ltResult = calcBracketTaxFrom(Math.max(0, longTermGain), LTCG_BRACKETS_2025, ordinaryIncome)
  const longTermTax = longTermGain > 0 ? ltResult.tax : 0

  // NIIT: 3.8% on investment income when MAGI > $200k (single)
  const magi = ordinaryIncome + Math.max(0, longTermGain)
  const niit = magi > NIIT_THRESHOLD_SINGLE
    ? Math.min(totalInvestmentIncome, magi - NIIT_THRESHOLD_SINGLE) * NIIT_RATE
    : 0

  const totalEstimatedTax = shortTermTax + longTermTax + niit
  const totalGains = Math.max(0, shortTermGain) + Math.max(0, longTermGain)
  const effectiveRate = totalGains > 0 ? totalEstimatedTax / totalGains : 0

  return {
    shortTermTax,
    longTermTax,
    niit,
    totalEstimatedTax,
    effectiveRate,
    marginalRates: {
      shortTerm: stResult.marginalRate,
      longTerm: ltResult.marginalRate,
    },
  }
}
