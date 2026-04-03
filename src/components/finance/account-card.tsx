"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { AccountTypeBadge } from "./account-type-badge"
import { InstitutionLogo } from "./institution-logo"

const TYPE_COLORS: Record<string, string> = {
  checking: "#10b981",
  savings: "#3b82f6",
  credit: "#f97316",
  business_credit: "#f97316",
  investment: "#8b5cf6",
  brokerage: "#8b5cf6",
  loan: "#ef4444",
  mortgage: "#ef4444",
}

interface AccountCardProps {
  account: {
    id: string
    name: string
    type: string
    mask?: string | null
    subtype?: string | null
    currentBalance: number | null
    availableBalance?: number | null
    creditLimit?: number | null
  }
  institutionLogo?: string | null
  institutionName: string
  isSelected?: boolean
  onClick?: () => void
}

export function AccountCard({
  account,
  institutionLogo,
  institutionName,
  isSelected,
  onClick,
}: AccountCardProps) {
  const typeColor = TYPE_COLORS[account.type] ?? "#64748b"
  const balance = Math.abs(account.currentBalance ?? 0)
  const utilization = account.creditLimit
    ? (balance / account.creditLimit) * 100
    : null

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left bg-card border rounded-xl p-4 transition-colors duration-200 card-hover-lift",
        isSelected
          ? "border-primary ring-1 ring-primary/20"
          : "border-card-border hover:border-card-border-hover"
      )}
      style={{ borderLeftWidth: 4, borderLeftColor: typeColor }}
    >
      {/* Header: logo + name */}
      <div className="flex items-center gap-3 mb-3">
        <InstitutionLogo src={institutionLogo} size={7} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {account.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <AccountTypeBadge type={account.type} />
            {account.mask && (
              <span className="text-[10px] text-foreground-muted">••{account.mask}</span>
            )}
            {account.subtype && (account.type === "investment" || account.type === "brokerage") && (
              <span className="text-[10px] text-foreground-muted capitalize">{account.subtype.replace(/_/g, " ")}</span>
            )}
          </div>
        </div>
      </div>

      {/* Balance */}
      <p className="font-data text-xl font-bold text-foreground tabular-nums">
        {account.type === "credit" || account.type === "business_credit" ? "-" : ""}
        {formatCurrency(balance)}
      </p>

      {/* Available balance (if different) */}
      {account.availableBalance != null && account.availableBalance !== account.currentBalance && (
        <p className="text-[10px] text-foreground-muted mt-0.5">
          {formatCurrency(account.availableBalance)} available
        </p>
      )}

      {/* Credit utilization bar */}
      {utilization != null && account.creditLimit != null && (
        <div className="mt-2">
          <div className="w-full h-1.5 rounded-full bg-background-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-colors",
                utilization >= 75 ? "bg-error"
                  : utilization >= 50 ? "bg-orange-500"
                    : utilization >= 30 ? "bg-amber-500"
                      : "bg-success"
              )}
              style={{ width: `${Math.min(utilization, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-foreground-muted tabular-nums">
              {utilization.toFixed(0)}% used
            </span>
            <span className="text-[10px] text-foreground-muted tabular-nums">
              {formatCurrency(account.creditLimit)} limit
            </span>
          </div>
        </div>
      )}

      {/* Institution name */}
      <p className="text-[10px] text-foreground-muted mt-2 truncate">{institutionName}</p>
    </button>
  )
}
