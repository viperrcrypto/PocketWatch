import { cn } from "@/lib/utils"

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  checking: { label: "Checking", color: "badge-neutral", icon: "account_balance" },
  savings: { label: "Savings", color: "badge-success", icon: "savings" },
  credit: { label: "Credit", color: "badge-warning", icon: "credit_card" },
  business_credit: { label: "Business CC", color: "badge-warning", icon: "credit_card" },
  investment: { label: "Investment", color: "badge-neutral", icon: "trending_up" },
  loan: { label: "Loan", color: "badge-error", icon: "account_balance" },
  mortgage: { label: "Mortgage", color: "badge-error", icon: "home" },
}

interface AccountTypeBadgeProps {
  type: string
  className?: string
}

export function AccountTypeBadge({ type, className }: AccountTypeBadgeProps) {
  const config = TYPE_CONFIG[type] ?? { label: type, color: "badge-neutral", icon: "help" }
  return (
    <span className={cn("badge inline-flex items-center gap-1", config.color, className)}>
      <span className="material-symbols-rounded text-xs">{config.icon}</span>
      {config.label}
    </span>
  )
}
