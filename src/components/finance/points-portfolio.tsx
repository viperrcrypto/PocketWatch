"use client"

import { formatCurrency } from "@/lib/utils"

const PROGRAM_COLORS: Record<string, string> = {
  "Chase Ultimate Rewards": "#0A3263",
  "Amex Membership Rewards": "#006FCF",
  "Citi ThankYou": "#003B70",
  "Capital One Miles": "#D12028",
  "Discover Cashback": "#FF6000",
}

interface PointsProgram {
  programName: string
  balance: number
  centsPerPoint: number
  totalValue: number
}

interface PointsPortfolioProps {
  programs: PointsProgram[]
  totalValue: number
}

export function PointsPortfolio({ programs, totalValue }: PointsPortfolioProps) {
  if (programs.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-8">No points data available</p>
  }

  return (
    <div>
      {/* Hero total */}
      <div className="text-center mb-6">
        <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1">
          Total Portfolio Value
        </p>
        <p className="font-data text-3xl font-bold text-foreground tabular-nums">
          {formatCurrency(totalValue)}
        </p>
      </div>

      {/* Per-program cards */}
      <div className="space-y-2">
        {programs.map((p) => {
          const color = Object.entries(PROGRAM_COLORS).find(
            ([k]) => p.programName.toLowerCase().includes(k.toLowerCase())
          )?.[1] ?? "#6366f1"

          return (
            <div
              key={p.programName}
              className="flex items-center gap-3 p-3 rounded-xl border border-card-border hover:border-card-border-hover transition-colors"
              style={{ borderLeftWidth: 3, borderLeftColor: color }}
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: color }}
              >
                {p.programName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.programName}</p>
                <p className="text-[10px] text-foreground-muted">
                  {p.balance.toLocaleString()} pts · {p.centsPerPoint.toFixed(1)}cpp
                </p>
              </div>
              <span className="font-data text-sm font-semibold text-foreground tabular-nums flex-shrink-0">
                {formatCurrency(p.totalValue)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
