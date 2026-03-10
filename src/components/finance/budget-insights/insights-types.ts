export interface ComparisonItem {
  category: string
  dataDriven: number
  avgMonthly: number
  yourBudget: number | null
  currentSpent: number
  monthsOfData: number
  gap: number // positive = over-budgeted, negative = under-budgeted
  gapPercent: number
  verdict: "well-aligned" | "under-budgeted" | "over-budgeted" | "missing"
}
