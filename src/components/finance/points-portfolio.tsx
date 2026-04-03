"use client"

import { useState } from "react"
import { formatCurrency, cn } from "@/lib/utils"

const PROGRAM_COLORS: Record<string, string> = {
  "chase ultimate rewards": "#0A3263",
  "amex membership rewards": "#006FCF",
  "citi thankyou": "#003B70",
  "capital one miles": "#D12028",
  "discover cashback": "#FF6000",
  "wells fargo rewards": "#C2272D",
  "bank of america": "#012169",
  "us bank": "#0B3D91",
  "barclays": "#00AEEF",
}

function getProgramColor(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, color] of Object.entries(PROGRAM_COLORS)) {
    if (lower.includes(key)) return color
  }
  return "#6366f1"
}

function getProgramIcon(name: string): string {
  const lower = name.toLowerCase()
  if (lower.includes("amazon")) return "shopping_cart"
  if (lower.includes("chase") || lower.includes("ultimate")) return "diamond"
  if (lower.includes("amex") || lower.includes("membership")) return "stars"
  if (lower.includes("citi") || lower.includes("thankyou")) return "payments"
  if (lower.includes("capital one") || lower.includes("miles")) return "flight"
  if (lower.includes("discover") || lower.includes("cashback")) return "savings"
  return "loyalty"
}

function ProgramAvatar({ program }: { program: PointsProgram }) {
  const [imgFailed, setImgFailed] = useState(false)
  const color = getProgramColor(program.programName)
  const imageUrl = program.cardImageUrls?.[0]

  if (imageUrl && !imgFailed) {
    return (
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-background-secondary relative">
        <img
          src={imageUrl}
          alt={program.programName}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  const icon = getProgramIcon(program.programName)
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center text-white flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{icon}</span>
    </div>
  )
}

interface PointsProgram {
  programName: string
  balance: number
  centsPerPoint: number
  totalValue: number
  estimatedMonthlyReward?: number
  rewardType?: string
  cardNames?: string[]
  cardImageUrls?: string[]
}

interface PointsPortfolioProps {
  programs: PointsProgram[]
  totalValue: number
  totalMonthlyReward?: number
}

export function PointsPortfolio({ programs, totalValue, totalMonthlyReward = 0 }: PointsPortfolioProps) {
  if (programs.length === 0) {
    return (
      <div className="text-center py-8">
        <span className="material-symbols-rounded text-foreground-muted/30 mb-2 block" style={{ fontSize: 32 }}>
          account_balance_wallet
        </span>
        <p className="text-sm text-foreground-muted">No rewards programs found</p>
        <p className="text-[10px] text-foreground-muted/60 mt-1">Enrich cards to detect reward programs</p>
      </div>
    )
  }

  const hasBalances = totalValue > 0
  const hasMonthlyRewards = totalMonthlyReward > 0

  // Nothing meaningful to show — balances not tracked and no estimated rewards
  if (!hasBalances && !hasMonthlyRewards) {
    return (
      <div>
        <div className="text-center mb-5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1">
            Rewards Programs
          </p>
          <p className="text-sm text-foreground-muted mt-2">
            Point balances not currently tracked
          </p>
          <p className="text-[10px] text-foreground-muted/60 mt-1">
            {programs.length} program{programs.length !== 1 ? "s" : ""} detected — balances require manual entry or institution support
          </p>
        </div>
        <div className="space-y-2">
          {programs.map((p) => {
            return (
              <div key={p.programName} className="flex items-center gap-3 p-3 rounded-xl border border-card-border">
                <ProgramAvatar program={p} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.programName}</p>
                  {p.cardNames && p.cardNames.length > 0 && (
                    <p className="text-[10px] text-foreground-muted truncate mt-0.5">
                      {p.cardNames.join(", ")}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-foreground-muted/60 italic flex-shrink-0">Not tracked</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Hero */}
      <div className="text-center mb-5">
        {hasBalances ? (
          <>
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1">
              Total Portfolio Value
            </p>
            <p className="font-data text-3xl font-bold text-foreground tabular-nums">
              {formatCurrency(totalValue)}
            </p>
          </>
        ) : (
          <>
            <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1">
              Estimated Monthly Earnings
            </p>
            <p className="font-data text-3xl font-bold text-success tabular-nums">
              +{formatCurrency(totalMonthlyReward)}
            </p>
            <p className="text-[10px] text-foreground-muted mt-1">
              across {programs.length} reward program{programs.length !== 1 ? "s" : ""}
            </p>
          </>
        )}
      </div>

      {/* Allocation bar with legend */}
      {programs.length > 1 && (hasBalances || hasMonthlyRewards) && (
        <div className="mb-5">
          <div className="flex h-2 rounded-full overflow-hidden gap-px">
            {programs.map((p) => {
              const color = getProgramColor(p.programName)
              const value = hasBalances ? p.totalValue : (p.estimatedMonthlyReward ?? 0)
              const total = hasBalances ? totalValue : totalMonthlyReward
              const pct = total > 0 ? (value / total) * 100 : 0
              return (
                <div
                  key={p.programName}
                  className="h-full rounded-full transition-colors duration-300"
                  style={{ width: `${Math.max(pct, 3)}%`, backgroundColor: color }}
                />
              )
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {programs.map((p) => {
              const color = getProgramColor(p.programName)
              const value = hasBalances ? p.totalValue : (p.estimatedMonthlyReward ?? 0)
              const total = hasBalances ? totalValue : totalMonthlyReward
              const pct = total > 0 ? (value / total) * 100 : 0
              if (pct < 1) return null
              return (
                <div key={p.programName} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[9px] text-foreground-muted truncate max-w-[100px]">
                    {p.programName.replace(/(rewards|membership|points|miles)/gi, "").trim()}
                  </span>
                  <span className="text-[9px] font-data font-bold tabular-nums text-foreground-muted/60">
                    {pct.toFixed(0)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Per-program cards */}
      <div className="space-y-2">
        {programs.map((p) => {
          const monthlyReward = p.estimatedMonthlyReward ?? 0
          const isCashback = p.rewardType === "cashback"

          return (
            <div
              key={p.programName}
              className="relative p-3 rounded-xl border border-card-border hover:border-card-border-hover transition-colors overflow-hidden"
            >
              <div className="relative flex items-center gap-3">
                <ProgramAvatar program={p} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.programName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {p.balance > 0 && (
                      <>
                        <span className="text-[10px] text-foreground-muted font-data tabular-nums">
                          {p.balance.toLocaleString()} {isCashback ? "cashback" : "pts"}
                        </span>
                        {!isCashback && p.centsPerPoint > 0 && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-foreground-muted/30" />
                            <span className={cn(
                              "text-[10px] font-medium tabular-nums",
                              p.centsPerPoint >= 1.5 ? "text-success" : "text-foreground-muted"
                            )}>
                              {p.centsPerPoint.toFixed(1)}¢/pt
                            </span>
                          </>
                        )}
                      </>
                    )}
                    {p.cardNames && p.cardNames.length > 0 && p.balance === 0 && (
                      <span className="text-[10px] text-foreground-muted truncate">
                        {p.cardNames[0]}{p.cardNames.length > 1 ? ` +${p.cardNames.length - 1}` : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {hasBalances && p.totalValue > 0 ? (
                    <span className="font-data text-sm font-semibold text-foreground tabular-nums">
                      {formatCurrency(p.totalValue)}
                    </span>
                  ) : monthlyReward > 0 ? (
                    <span className="font-data text-sm font-semibold text-success tabular-nums">
                      +{formatCurrency(monthlyReward)}/mo
                    </span>
                  ) : (
                    <span className="font-data text-sm text-foreground-muted tabular-nums">—</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
