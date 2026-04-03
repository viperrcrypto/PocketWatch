"use client"

import Link from "next/link"
import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { CollapsibleSection } from "./collapsible-section"
import { formatDateLabel, GradIcon } from "./insights-helpers"

export function InsightsCategoryComparison({ data }: { data?: any[] }) {
  if (!data || data.length === 0) return null
  return (
    <CollapsibleSection title="Category Month-over-Month">
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="space-y-1">
          {data.map((c) => {
            const meta = getCategoryMeta(c.category)
            const arrow = c.direction === "up" ? "trending_up" : c.direction === "down" ? "trending_down" : "trending_flat"
            const isUp = c.changePercent > 0, isDown = c.changePercent < 0
            return (
              <Link
                key={c.category}
                href={`/finance/transactions?category=${encodeURIComponent(c.category)}`}
                className="flex items-center gap-3 px-2 py-2 rounded-lg transition-colors hover:bg-foreground/[0.04]"
              >
                <GradIcon meta={meta} />
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">{c.category}</span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-data text-xs text-foreground-muted tabular-nums w-20 text-right">{formatCurrency(c.previousTotal)}</span>
                  <span className={cn("material-symbols-rounded", isUp ? "text-error" : isDown ? "text-success" : "text-foreground-muted")} style={{ fontSize: 16 }}>{arrow}</span>
                  <span className="font-data text-sm font-medium text-foreground tabular-nums w-20 text-right">{formatCurrency(c.currentTotal)}</span>
                  {c.changePercent !== null && (
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full font-data text-[10px] font-bold tabular-nums",
                      isUp ? "bg-error/10 text-error" : isDown ? "bg-success/10 text-success" : "bg-foreground/5 text-foreground-muted"
                    )}>
                      {isUp ? "+" : ""}{c.changePercent}%
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function InsightsIncomeSources({ sources }: { sources?: any[] }) {
  if (!sources || sources.length === 0) return null
  const maxIncome = sources[0].amount
  return (
    <CollapsibleSection title="Income Sources">
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="space-y-3">
          {sources.map((src, i) => {
            const barWidth = maxIncome > 0 ? (src.amount / maxIncome) * 100 : 0
            return (
              <div key={src.name} className="flex items-center gap-3">
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 18, color: "#22c55e" }}>payments</span>
                <span className="text-xs font-bold text-foreground-muted/50 tabular-nums w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground truncate">{src.name}</span>
                    <span className="font-data text-sm font-medium text-success tabular-nums ml-2">{formatCurrency(src.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-background-secondary overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-500"
                      style={{ width: `${barWidth}%`, background: "linear-gradient(90deg, #22c55e, #16a34a)" }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function InsightsBudgetHealth({ budgetHealth }: { budgetHealth?: any[] }) {
  if (!budgetHealth || budgetHealth.length === 0) return null
  return (
    <CollapsibleSection title="Budget Health">
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="space-y-4">
          {budgetHealth.map((b) => {
            const meta = getCategoryMeta(b.category)
            const over = b.percentUsed >= 100, warn = b.percentUsed >= 80
            const barBg = over ? `linear-gradient(90deg, var(--error), color-mix(in srgb, var(--error) 80%, #000))`
              : warn ? "linear-gradient(90deg, #f59e0b, #d97706)" : "linear-gradient(90deg, #22c55e, #16a34a)"
            return (
              <Link
                key={b.category}
                href={`/finance/transactions?category=${encodeURIComponent(b.category)}`}
                className={cn("block rounded-xl p-3 -mx-1 transition-colors hover:bg-foreground/[0.04]", over && "ring-1 ring-error/30 shadow-[0_0_12px_-3px_var(--error)]")}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <GradIcon meta={meta} />
                    <span className="text-sm text-foreground">{b.category}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-data text-xs text-foreground-muted tabular-nums">
                      {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                    </span>
                    <span className={cn(
                      "inline-flex items-center px-2 py-0.5 rounded-full font-data text-[10px] font-bold tabular-nums",
                      over ? "bg-error/10 text-error" : warn ? "bg-amber-500/10 text-amber-500" : "bg-success/10 text-success"
                    )}>{Math.round(b.percentUsed)}%</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-background-secondary overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-500"
                    style={{ width: `${Math.min(b.percentUsed, 100)}%`, background: barBg }} />
                </div>
                {b.projectedOverage > 0 && (
                  <p className="text-[10px] text-error mt-1.5 font-medium">Projected {formatCurrency(b.projectedOverage)} over budget</p>
                )}
              </Link>
            )
          })}
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function InsightsTopCategories({ categories }: { categories?: any[] }) {
  if (!categories || categories.length === 0) return null
  return (
    <CollapsibleSection title="Top Categories">
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="space-y-4">
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat.category)
            return (
              <Link
                key={cat.category}
                href={`/finance/transactions?category=${encodeURIComponent(cat.category)}`}
                className="flex gap-3 rounded-lg pl-1 hover:bg-foreground/[0.04] py-1 transition-colors"
              >
                <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 20, color: meta.hex }}>{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{cat.category}</span>
                    <span className="font-data text-sm font-semibold text-foreground tabular-nums">{formatCurrency(cat.total)}</span>
                  </div>
                  {cat.topMerchants.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {cat.topMerchants.slice(0, 3).map((m: any) => (
                        <div key={m.name} className="flex items-center justify-between text-xs pl-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: meta.hex, opacity: 0.5 }} />
                            <span className="text-foreground-muted truncate">{m.name}</span>
                          </div>
                          <span className="font-data text-foreground-muted tabular-nums ml-2">{formatCurrency(m.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function InsightsMerchantsPurchases({ deep }: { deep: any }) {
  const hasMerchants = deep?.frequentMerchants && deep.frequentMerchants.length > 0
  const hasPurchases = deep?.largestPurchases && deep.largestPurchases.length > 0
  if (!hasMerchants && !hasPurchases) return null
  return (
    <CollapsibleSection title="Merchants & Purchases" defaultOpen={true}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasMerchants && (
          <div className="bg-card border border-card-border rounded-xl p-6">
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Top Merchants</span>
            <div className="mt-3 space-y-3">
              {deep.frequentMerchants.map((m: any, i: number) => {
                const maxTotal = deep.frequentMerchants![0].total
                const barWidth = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0
                const meta = getCategoryMeta(m.category)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: 18, color: meta.hex }}>{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-foreground truncate">{m.name}</span>
                        <span className="font-data text-sm font-medium text-foreground tabular-nums ml-2">{formatCurrency(m.total)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-background-secondary overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-500"
                          style={{ width: `${barWidth}%`, background: `linear-gradient(90deg, ${meta.hex}, color-mix(in srgb, ${meta.hex} 80%, #000))` }} />
                      </div>
                      <span className="text-[10px] text-foreground-muted">{m.count} transactions</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {hasPurchases && (
          <div className="bg-card border border-card-border rounded-xl p-6">
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Largest Purchases</span>
            <div className="mt-4 space-y-3">
              {deep.largestPurchases.map((tx: any) => {
                const meta = getCategoryMeta(tx.category)
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-card-border/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <GradIcon meta={meta} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.name}</p>
                        <p className="text-[10px] text-foreground-muted">{formatDateLabel(tx.date)}</p>
                      </div>
                    </div>
                    <span className="font-data text-sm font-semibold text-foreground tabular-nums ml-2">{formatCurrency(tx.amount)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}

export function InsightsDayOfWeek({ patterns }: { patterns: any[] | undefined }) {
  if (!patterns || patterns.length === 0) return null
  const maxDay = Math.max(...patterns.map((p) => p.total))
  return (
    <CollapsibleSection title="Spending by Day of Week" defaultOpen={true}>
      <div className="bg-card border border-card-border rounded-xl overflow-hidden">
        <div className="p-5">
          <div className="grid grid-cols-7 gap-2">
            {patterns.map((d) => {
              const intensity = maxDay > 0 ? d.total / maxDay : 0
              const barHeight = Math.max(intensity * 80, 6)
              const gradColor = intensity > 0.75 ? "var(--error), color-mix(in srgb, var(--error) 70%, #000)"
                : intensity > 0.5 ? "var(--warning), color-mix(in srgb, var(--warning) 70%, #000)"
                : intensity > 0.25 ? "var(--primary), color-mix(in srgb, var(--primary) 70%, #000)" : "#94a3b8, #64748b"
              return (
                <div key={d.day} className="flex flex-col items-center gap-1.5 group rounded-lg py-2 transition-colors hover:bg-foreground/[0.03]">
                  <div className="w-full h-20 flex items-end justify-center">
                    <div className="w-full max-w-[40px] rounded-t-lg transition-[width] duration-500 group-hover:opacity-90"
                      style={{ height: `${barHeight}%`, background: `linear-gradient(to top, ${gradColor})`, opacity: 0.7 + intensity * 0.3 }} />
                  </div>
                  <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">{d.day}</span>
                  <span className="font-data text-[9px] font-bold tabular-nums text-foreground-muted">{formatCurrency(d.total, "USD", 0)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function InsightsAnomalies({ anomalies }: { anomalies: any[] | undefined }) {
  if (!anomalies || anomalies.length === 0) return null
  return (
    <div className="bg-card border border-error/20 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-card-border/50 flex items-center gap-2">
        <span className="material-symbols-rounded text-error" style={{ fontSize: 18 }}>warning</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Unusual Spending</span>
          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-error opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-error" /></span>
          <span className="text-[10px] text-foreground-muted">{anomalies.length} anomal{anomalies.length === 1 ? "y" : "ies"}</span>
        </div>
      </div>
      <div className="divide-y divide-card-border/30">
        {anomalies.map((a) => {
          const meta = getCategoryMeta(a.category)
          return (
            <Link
              key={a.category}
              href={`/finance/transactions?category=${encodeURIComponent(a.category)}`}
              className="px-5 py-3 flex items-center gap-3 hover:bg-card-hover transition-colors cursor-pointer"
            >
              <GradIcon meta={meta} size={36} icon={16} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{a.category}</p>
                <p className="text-[10px] text-foreground-muted">{formatCurrency(a.previousAmount)} last month → <span className="text-error font-semibold">{formatCurrency(a.currentAmount)}</span> this month</p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-black font-data tabular-nums bg-error/15 text-error ring-1 ring-error/20 flex-shrink-0">
                {a.multiplier.toFixed(1)}x
              </span>
              <span className="material-symbols-rounded text-foreground-muted flex-shrink-0" style={{ fontSize: 16 }}>chevron_right</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
