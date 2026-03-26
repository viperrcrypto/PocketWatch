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
    bgClass: "bg-indigo-600/10", textClass: "text-indigo-600",
    dotClass: "bg-indigo-600", borderClass: "border-indigo-600",
    hex: "#4f46e5",
  },
  "Food & Dining": {
    label: "Food & Dining", icon: "restaurant", color: "orange",
    bgClass: "bg-orange-600/10", textClass: "text-orange-600",
    dotClass: "bg-orange-600", borderClass: "border-orange-600",
    hex: "#ea580c",
  },
  "Transportation": {
    label: "Transportation", icon: "directions_car", color: "blue",
    bgClass: "bg-blue-500/10", textClass: "text-blue-500",
    dotClass: "bg-blue-500", borderClass: "border-blue-500",
    hex: "#3b82f6",
  },
  "Bills & Utilities": {
    label: "Bills & Utilities", icon: "bolt", color: "cyan",
    bgClass: "bg-cyan-600/10", textClass: "text-cyan-600",
    dotClass: "bg-cyan-600", borderClass: "border-cyan-600",
    hex: "#0891b2",
  },
  "Entertainment": {
    label: "Entertainment", icon: "tv", color: "rose",
    bgClass: "bg-rose-600/10", textClass: "text-rose-600",
    dotClass: "bg-rose-600", borderClass: "border-rose-600",
    hex: "#e11d48",
  },
  "Shopping": {
    label: "Shopping", icon: "shopping_bag", color: "teal",
    bgClass: "bg-teal-600/10", textClass: "text-teal-600",
    dotClass: "bg-teal-600", borderClass: "border-teal-600",
    hex: "#0d9488",
  },
  "Health & Fitness": {
    label: "Health & Fitness", icon: "favorite", color: "pink",
    bgClass: "bg-pink-600/10", textClass: "text-pink-600",
    dotClass: "bg-pink-600", borderClass: "border-pink-600",
    hex: "#db2777",
  },
  "Personal Care": {
    label: "Personal Care", icon: "person", color: "purple",
    bgClass: "bg-purple-600/10", textClass: "text-purple-600",
    dotClass: "bg-purple-600", borderClass: "border-purple-600",
    hex: "#9333ea",
  },
  "Education": {
    label: "Education", icon: "school", color: "blue",
    bgClass: "bg-blue-600/10", textClass: "text-blue-600",
    dotClass: "bg-blue-600", borderClass: "border-blue-600",
    hex: "#2563eb",
  },
  "Travel": {
    label: "Travel", icon: "flight", color: "sky",
    bgClass: "bg-sky-600/10", textClass: "text-sky-600",
    dotClass: "bg-sky-600", borderClass: "border-sky-600",
    hex: "#0284c7",
  },
  "Business Expenses": {
    label: "Business Expenses", icon: "business_center", color: "zinc",
    bgClass: "bg-zinc-700/10", textClass: "text-zinc-700",
    dotClass: "bg-zinc-700", borderClass: "border-zinc-700",
    hex: "#3f3f46",
  },
  "Investment": {
    label: "Investment", icon: "trending_up", color: "emerald",
    bgClass: "bg-emerald-600/10", textClass: "text-emerald-600",
    dotClass: "bg-emerald-600", borderClass: "border-emerald-600",
    hex: "#059669",
  },
  "Insurance": {
    label: "Insurance", icon: "shield", color: "violet",
    bgClass: "bg-violet-600/10", textClass: "text-violet-600",
    dotClass: "bg-violet-600", borderClass: "border-violet-600",
    hex: "#7c3aed",
  },
  "Gifts & Donations": {
    label: "Gifts & Donations", icon: "redeem", color: "fuchsia",
    bgClass: "bg-fuchsia-600/10", textClass: "text-fuchsia-600",
    dotClass: "bg-fuchsia-600", borderClass: "border-fuchsia-600",
    hex: "#c026d3",
  },
  "Crypto": {
    label: "Crypto", icon: "currency_bitcoin", color: "orange",
    bgClass: "bg-orange-500/10", textClass: "text-orange-500",
    dotClass: "bg-orange-500", borderClass: "border-orange-500",
    hex: "#f97316",
  },
  "Taxes": {
    label: "Taxes", icon: "account_balance", color: "red",
    bgClass: "bg-red-600/10", textClass: "text-red-600",
    dotClass: "bg-red-600", borderClass: "border-red-600",
    hex: "#dc2626",
  },
  "Fees & Charges": {
    label: "Fees & Charges", icon: "receipt_long", color: "red",
    bgClass: "bg-red-500/10", textClass: "text-red-500",
    dotClass: "bg-red-500", borderClass: "border-red-500",
    hex: "#ef4444",
  },
  "Transfer": {
    label: "Transfer", icon: "swap_horiz", color: "sky",
    bgClass: "bg-sky-600/10", textClass: "text-sky-600",
    dotClass: "bg-sky-600", borderClass: "border-sky-600",
    hex: "#0284c7",
  },
  "Income": {
    label: "Income", icon: "wallet", color: "green",
    bgClass: "bg-green-600/10", textClass: "text-green-600",
    dotClass: "bg-green-600", borderClass: "border-green-600",
    hex: "#16a34a",
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
