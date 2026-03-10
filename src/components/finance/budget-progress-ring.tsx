"use client"

import { formatCurrency } from "@/lib/utils"

interface BudgetProgressRingProps {
  spent: number
  budget: number
  size?: number
}

export function BudgetProgressRing({ spent, budget, size = 192 }: BudgetProgressRingProps) {
  const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const r = 45
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - percent / 100)

  const strokeColor =
    percent >= 100
      ? "var(--error)"
      : percent >= 80
      ? "var(--warning)"
      : "var(--primary)"

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="transparent"
          stroke="var(--card-border)"
          strokeWidth="7"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="transparent"
          stroke={strokeColor}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black font-data tabular-nums text-foreground">
          {formatCurrency(spent, "USD", 0)}
        </span>
        <span className="text-[10px] text-foreground-muted font-bold uppercase tracking-widest">
          of {formatCurrency(budget, "USD", 0)}
        </span>
      </div>
    </div>
  )
}
