/**
 * 19 finance categories with colors and Material Symbols icons.
 * Used across all finance pages for consistent category styling.
 */

export interface CategoryMeta {
  label: string
  icon: string
  color: string      // Tailwind color name
  bgClass: string    // bg-{color}/10
  textClass: string  // text-{color}
  dotClass: string   // bg-{color}
  borderClass: string // border-{color}
  hex: string        // CSS hex for charts
}

export const FINANCE_CATEGORIES: Record<string, CategoryMeta> = {
  "Housing": {
    label: "Housing", icon: "home", color: "indigo",
    bgClass: "bg-indigo-500/10", textClass: "text-indigo-500",
    dotClass: "bg-indigo-500", borderClass: "border-indigo-500",
    hex: "#6366f1",
  },
  "Food & Dining": {
    label: "Food & Dining", icon: "restaurant", color: "red",
    bgClass: "bg-red-500/10", textClass: "text-red-500",
    dotClass: "bg-red-500", borderClass: "border-red-500",
    hex: "#ef4444",
  },
  "Transportation": {
    label: "Transportation", icon: "directions_car", color: "amber",
    bgClass: "bg-amber-500/10", textClass: "text-amber-500",
    dotClass: "bg-amber-500", borderClass: "border-amber-500",
    hex: "#f59e0b",
  },
  "Bills & Utilities": {
    label: "Bills & Utilities", icon: "bolt", color: "cyan",
    bgClass: "bg-cyan-500/10", textClass: "text-cyan-500",
    dotClass: "bg-cyan-500", borderClass: "border-cyan-500",
    hex: "#06b6d4",
  },
  "Entertainment": {
    label: "Entertainment", icon: "tv", color: "orange",
    bgClass: "bg-orange-500/10", textClass: "text-orange-500",
    dotClass: "bg-orange-500", borderClass: "border-orange-500",
    hex: "#f97316",
  },
  "Shopping": {
    label: "Shopping", icon: "shopping_bag", color: "teal",
    bgClass: "bg-teal-500/10", textClass: "text-teal-500",
    dotClass: "bg-teal-500", borderClass: "border-teal-500",
    hex: "#14b8a6",
  },
  "Health & Fitness": {
    label: "Health & Fitness", icon: "favorite", color: "pink",
    bgClass: "bg-pink-500/10", textClass: "text-pink-500",
    dotClass: "bg-pink-500", borderClass: "border-pink-500",
    hex: "#ec4899",
  },
  "Personal Care": {
    label: "Personal Care", icon: "person", color: "purple",
    bgClass: "bg-purple-500/10", textClass: "text-purple-500",
    dotClass: "bg-purple-500", borderClass: "border-purple-500",
    hex: "#a855f7",
  },
  "Education": {
    label: "Education", icon: "school", color: "blue",
    bgClass: "bg-blue-500/10", textClass: "text-blue-500",
    dotClass: "bg-blue-500", borderClass: "border-blue-500",
    hex: "#3b82f6",
  },
  "Travel": {
    label: "Travel", icon: "flight", color: "sky",
    bgClass: "bg-sky-500/10", textClass: "text-sky-500",
    dotClass: "bg-sky-500", borderClass: "border-sky-500",
    hex: "#0ea5e9",
  },
  "Business Expenses": {
    label: "Business Expenses", icon: "business_center", color: "slate",
    bgClass: "bg-slate-500/10", textClass: "text-slate-500",
    dotClass: "bg-slate-500", borderClass: "border-slate-500",
    hex: "#64748b",
  },
  "Investment": {
    label: "Investment", icon: "trending_up", color: "emerald",
    bgClass: "bg-emerald-500/10", textClass: "text-emerald-500",
    dotClass: "bg-emerald-500", borderClass: "border-emerald-500",
    hex: "#10b981",
  },
  "Insurance": {
    label: "Insurance", icon: "shield", color: "purple",
    bgClass: "bg-purple-400/10", textClass: "text-purple-400",
    dotClass: "bg-purple-400", borderClass: "border-purple-400",
    hex: "#c084fc",
  },
  "Gifts & Donations": {
    label: "Gifts & Donations", icon: "redeem", color: "pink",
    bgClass: "bg-pink-400/10", textClass: "text-pink-400",
    dotClass: "bg-pink-400", borderClass: "border-pink-400",
    hex: "#f472b6",
  },
  "Crypto": {
    label: "Crypto", icon: "currency_bitcoin", color: "amber",
    bgClass: "bg-amber-400/10", textClass: "text-amber-400",
    dotClass: "bg-amber-400", borderClass: "border-amber-400",
    hex: "#fbbf24",
  },
  "Taxes": {
    label: "Taxes", icon: "account_balance", color: "red",
    bgClass: "bg-red-400/10", textClass: "text-red-400",
    dotClass: "bg-red-400", borderClass: "border-red-400",
    hex: "#f87171",
  },
  "Fees & Charges": {
    label: "Fees & Charges", icon: "receipt_long", color: "slate",
    bgClass: "bg-slate-400/10", textClass: "text-slate-400",
    dotClass: "bg-slate-400", borderClass: "border-slate-400",
    hex: "#94a3b8",
  },
  "Transfer": {
    label: "Transfer", icon: "swap_horiz", color: "slate",
    bgClass: "bg-slate-500/10", textClass: "text-slate-500",
    dotClass: "bg-slate-500", borderClass: "border-slate-500",
    hex: "#64748b",
  },
  "Income": {
    label: "Income", icon: "wallet", color: "green",
    bgClass: "bg-green-500/10", textClass: "text-green-500",
    dotClass: "bg-green-500", borderClass: "border-green-500",
    hex: "#22c55e",
  },
  "Uncategorized": {
    label: "Uncategorized", icon: "more_horiz", color: "stone",
    bgClass: "bg-stone-500/10", textClass: "text-stone-500",
    dotClass: "bg-stone-500", borderClass: "border-stone-500",
    hex: "#78716c",
  },
}

/** Custom category shape from the database */
export interface CustomCategory {
  id: string
  label: string
  icon: string
  hex: string
}

/** Build CategoryMeta from a custom category */
function customToMeta(c: CustomCategory): CategoryMeta {
  return {
    label: c.label,
    icon: c.icon,
    color: "custom",
    bgClass: "bg-stone-500/10",
    textClass: "text-stone-500",
    dotClass: "bg-stone-500",
    borderClass: "border-stone-500",
    hex: c.hex,
  }
}

/**
 * Merge hardcoded categories with user-defined custom categories.
 * Custom categories are appended after built-in ones.
 */
export function buildCategoryMap(
  customCategories: CustomCategory[] = []
): Record<string, CategoryMeta> {
  const merged = { ...FINANCE_CATEGORIES }
  for (const c of customCategories) {
    if (!merged[c.label]) {
      merged[c.label] = customToMeta(c)
    }
  }
  return merged
}

/** Get category meta with fallback to custom categories, then Uncategorized */
export function getCategoryMeta(
  category: string | null | undefined,
  customCategories?: CustomCategory[]
): CategoryMeta {
  if (!category) return FINANCE_CATEGORIES["Uncategorized"]
  if (FINANCE_CATEGORIES[category]) return FINANCE_CATEGORIES[category]
  if (customCategories) {
    const custom = customCategories.find((c) => c.label === category)
    if (custom) return customToMeta(custom)
  }
  return FINANCE_CATEGORIES["Uncategorized"]
}

/** Chart-ready color array from a list of categories */
export function getCategoryColors(categories: string[]): string[] {
  return categories.map((cat) => getCategoryMeta(cat).hex)
}

/** All category keys excluding system ones (for budget selector, filters) */
export function getBudgetableCategories(): string[] {
  return Object.keys(FINANCE_CATEGORIES).filter(
    (c) => c !== "Uncategorized" && c !== "Transfer" && c !== "Income"
  )
}
