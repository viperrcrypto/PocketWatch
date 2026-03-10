import { cn } from "@/lib/utils"

const CATEGORY_COLORS: Record<string, string> = {
  "Housing": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Transportation": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "Food & Dining": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "Shopping": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Entertainment": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Health & Fitness": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Personal Care": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "Education": "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400",
  "Travel": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "Bills & Utilities": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Fees & Charges": "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  "Business Expenses": "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "Income": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Transfer": "bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400",
  "Investment": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Insurance": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "Gifts & Donations": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "Crypto": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Taxes": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "Uncategorized": "bg-neutral-100 text-neutral-500 dark:bg-neutral-900/30 dark:text-neutral-400",
}

const CATEGORY_ICONS: Record<string, string> = {
  "Housing": "home",
  "Transportation": "directions_car",
  "Food & Dining": "restaurant",
  "Shopping": "shopping_bag",
  "Entertainment": "movie",
  "Health & Fitness": "fitness_center",
  "Personal Care": "spa",
  "Education": "school",
  "Travel": "flight",
  "Bills & Utilities": "receipt",
  "Fees & Charges": "account_balance",
  "Business Expenses": "business_center",
  "Income": "payments",
  "Transfer": "swap_horiz",
  "Investment": "trending_up",
  "Insurance": "shield",
  "Gifts & Donations": "redeem",
  "Crypto": "currency_bitcoin",
  "Taxes": "account_balance",
  "Uncategorized": "help_outline",
}

interface CategoryBadgeProps {
  category: string | null
  showIcon?: boolean
  className?: string
}

export function CategoryBadge({ category, showIcon = true, className }: CategoryBadgeProps) {
  const cat = category ?? "Uncategorized"
  const color = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS["Uncategorized"]
  const icon = CATEGORY_ICONS[cat] ?? "help_outline"

  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", color, className)}>
      {showIcon && <span className="material-symbols-rounded text-xs">{icon}</span>}
      {cat}
    </span>
  )
}
