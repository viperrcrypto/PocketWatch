export const INVESTMENT_TYPE_OPTIONS = [
  { value: "stocks", label: "Stocks", icon: "show_chart", color: "#6366f1" },
  { value: "bonds", label: "Bonds", icon: "savings", color: "#10b981" },
  { value: "real_estate", label: "Real Estate", icon: "home", color: "#f59e0b" },
  { value: "crypto", label: "Crypto", icon: "currency_bitcoin", color: "#f97316" },
  { value: "other", label: "Other", icon: "account_balance_wallet", color: "#6b7280" },
] as const

export const TX_TYPE_TABS = [
  { value: "", label: "All" },
  { value: "buy", label: "Buy" },
  { value: "sell", label: "Sell" },
  { value: "dividend", label: "Dividend" },
  { value: "fee", label: "Fee" },
  { value: "transfer", label: "Transfer" },
]

export const CHART_RANGES = ["1W", "1M", "3M", "6M", "1Y", "ALL"] as const

export const RANGE_MAP: Record<string, "1w" | "1m" | "3m" | "6m" | "1y" | "all"> = {
  "1W": "1w", "1M": "1m", "3M": "3m", "6M": "6m", "1Y": "1y", "ALL": "all",
}

export function getInvestmentTypeMeta(subtype: string | null) {
  const found = INVESTMENT_TYPE_OPTIONS.find((o) => o.value === subtype)
  return found ?? INVESTMENT_TYPE_OPTIONS[4]
}
