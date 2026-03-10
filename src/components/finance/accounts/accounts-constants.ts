export const ACCOUNT_TYPES = [
  { key: "all", label: "All" },
  { key: "checking", label: "Checking" },
  { key: "savings", label: "Savings" },
  { key: "credit", label: "Credit" },
  { key: "investment", label: "Investment" },
  { key: "loan", label: "Loans" },
] as const

export const TYPE_ICONS: Record<string, string> = {
  checking: "account_balance",
  savings: "savings",
  credit: "credit_card",
  business_credit: "credit_card",
  investment: "trending_up",
  brokerage: "trending_up",
  loan: "request_quote",
  mortgage: "request_quote",
}

export const TYPE_ORDER = ["checking", "savings", "credit", "business_credit", "investment", "brokerage", "loan", "mortgage"]

export function normalizeType(type: string): string {
  if (type === "business_credit") return "credit"
  if (type === "brokerage") return "investment"
  if (type === "mortgage") return "loan"
  return type
}
