"use client"

import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { StaggerReveal } from "@/components/ui/stagger-reveal"

interface BreakdownItem {
  label: string
  value: number
  icon: string
  color: string
  href: string
}

interface NetWorthBreakdownProps {
  fiatCash: number
  fiatInvestments: number
  fiatDebt: number
  cryptoValue: number
  totalNetWorth: number
  isHidden: boolean
}

export function NetWorthBreakdown({
  fiatCash,
  fiatInvestments,
  fiatDebt,
  cryptoValue,
  totalNetWorth,
  isHidden,
}: NetWorthBreakdownProps) {
  const items: BreakdownItem[] = [
    { label: "Cash", value: fiatCash, icon: "account_balance", color: "text-emerald-500", href: "/finance/accounts" },
    { label: "Investments", value: fiatInvestments, icon: "show_chart", color: "text-violet-500", href: "/finance/investments" },
    { label: "Digital Assets", value: cryptoValue, icon: "currency_bitcoin", color: "text-amber-500", href: "/portfolio" },
    { label: "Debt", value: -fiatDebt, icon: "credit_card", color: "text-red-500", href: "/finance/cards" },
  ]

  const positiveTotal = fiatCash + fiatInvestments + cryptoValue

  return (
    <div className="space-y-4">
      {/* Allocation bar */}
      {positiveTotal > 0 && (
        <div className="flex h-2.5 rounded-full overflow-hidden bg-background-secondary">
          {fiatCash > 0 && (
            <div
              className="bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${(fiatCash / positiveTotal) * 100}%` }}
            />
          )}
          {fiatInvestments > 0 && (
            <div
              className="bg-violet-500 transition-[width] duration-500"
              style={{ width: `${(fiatInvestments / positiveTotal) * 100}%` }}
            />
          )}
          {cryptoValue > 0 && (
            <div
              className="bg-amber-500 transition-[width] duration-500"
              style={{ width: `${(cryptoValue / positiveTotal) * 100}%` }}
            />
          )}
        </div>
      )}

      {/* Item rows */}
      <StaggerReveal className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item) => {
          const pct = totalNetWorth !== 0
            ? ((Math.abs(item.value) / Math.abs(totalNetWorth)) * 100).toFixed(1)
            : "0.0"

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex items-center gap-3 bg-card rounded-xl px-4 py-3.5 card-hover-lift transition-colors"
              style={{ boxShadow: "var(--shadow-sm)" }}
            >
              <span className={cn("material-symbols-rounded flex-shrink-0", item.color)} style={{ fontSize: 20 }}>
                {item.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground-muted font-medium">{item.label}</p>
                <p className={cn("text-sm font-semibold tabular-nums", item.value < 0 ? "text-red-500" : "text-foreground")}>
                  <BlurredValue isHidden={isHidden}>
                    {formatCurrency(item.value)}
                  </BlurredValue>
                </p>
              </div>
              <span className="text-[10px] text-foreground-muted tabular-nums font-medium">
                {pct}%
              </span>
              <span className="material-symbols-rounded text-foreground-muted/40" style={{ fontSize: 16 }} aria-hidden="true">chevron_right</span>
            </Link>
          )
        })}
      </StaggerReveal>
    </div>
  )
}
