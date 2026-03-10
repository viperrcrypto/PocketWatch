"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { getCategoryMeta } from "@/lib/finance/categories"
import { InsightCard } from "@/components/finance/insight-card"
import { CollapsibleSection } from "./collapsible-section"
import { formatDateLabel } from "./insights-helpers"

export function InsightsCategoryComparison({ data }: { data?: any[] }) {
  if (!data || data.length === 0) return null

  return (
    <CollapsibleSection title="Category Month-over-Month">
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="space-y-3">
          {data.map((c) => {
            const meta = getCategoryMeta(c.category)
            const arrow = c.direction === "up" ? "trending_up" : c.direction === "down" ? "trending_down" : "trending_flat"
            const arrowColor = c.direction === "up" ? "text-error" : c.direction === "down" ? "text-success" : "text-foreground-muted"
            return (
              <div key={c.category} className="flex items-center gap-3">
                <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", meta.dotClass)} />
                <span className="text-sm text-foreground flex-1 min-w-0 truncate">{c.category}</span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="font-data text-xs text-foreground-muted tabular-nums w-20 text-right">
                    {formatCurrency(c.previousTotal)}
                  </span>
                  <span className={cn("material-symbols-rounded", arrowColor)} style={{ fontSize: 16 }}>
                    {arrow}
                  </span>
                  <span className="font-data text-sm font-medium text-foreground tabular-nums w-20 text-right">
                    {formatCurrency(c.currentTotal)}
                  </span>
                  {c.changePercent !== null && (
                    <span className={cn(
                      "font-data text-[10px] tabular-nums w-14 text-right",
                      c.changePercent > 0 ? "text-error" : c.changePercent < 0 ? "text-success" : "text-foreground-muted"
                    )}>
                      {c.changePercent > 0 ? "+" : ""}{c.changePercent}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function InsightsIncomeSources({ sources }: { sources?: any[] }) {
  if (!sources || sources.length === 0) return null

  return (
    <CollapsibleSection title="Income Sources">
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="space-y-3">
          {sources.map((src) => {
            const maxIncome = sources[0].amount
            const barWidth = maxIncome > 0 ? (src.amount / maxIncome) * 100 : 0
            return (
              <div key={src.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground truncate">{src.name}</span>
                  <span className="font-data text-sm font-medium text-success tabular-nums ml-2">
                    {formatCurrency(src.amount)}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-200 dark:bg-background-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-success/60 transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
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
            const barColor = b.percentUsed >= 100 ? "bg-error" : b.percentUsed >= 80 ? "bg-amber-500" : "bg-success"
            return (
              <div key={b.category}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={cn("w-2.5 h-2.5 rounded-full", meta.dotClass)} />
                    <span className="text-sm text-foreground">{b.category}</span>
                  </div>
                  <span className="font-data text-xs text-foreground-muted tabular-nums">
                    {formatCurrency(b.spent)} / {formatCurrency(b.limit)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 dark:bg-background-secondary overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", barColor)}
                    style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                  />
                </div>
                {b.projectedOverage > 0 && (
                  <p className="text-[10px] text-error mt-1">
                    Projected {formatCurrency(b.projectedOverage)} over budget
                  </p>
                )}
              </div>
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
        <div className="space-y-3">
          {categories.map((cat) => {
            const meta = getCategoryMeta(cat.category)
            return (
              <div key={cat.category} className="border-l-2 pl-4" style={{ borderColor: meta.hex }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("material-symbols-rounded", meta.textClass)} style={{ fontSize: 16 }}>
                      {meta.icon}
                    </span>
                    <span className="text-sm font-medium text-foreground">{cat.category}</span>
                  </div>
                  <span className="font-data text-sm font-semibold text-foreground tabular-nums">
                    {formatCurrency(cat.total)}
                  </span>
                </div>
                {cat.topMerchants.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {cat.topMerchants.slice(0, 3).map((m: any) => (
                      <div key={m.name} className="flex items-center justify-between text-xs">
                        <span className="text-foreground-muted truncate">{m.name}</span>
                        <span className="font-data text-foreground-muted tabular-nums ml-2">
                          {formatCurrency(m.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
    <CollapsibleSection title="Merchants & Purchases" defaultOpen={false}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {hasMerchants && (
          <div className="bg-card border border-card-border rounded-xl p-6">
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Top Merchants
            </span>
            <div className="mt-3 space-y-3">
              {deep.frequentMerchants.map((m: any, i: number) => {
                const maxTotal = deep.frequentMerchants![0].total
                const barWidth = maxTotal > 0 ? (m.total / maxTotal) * 100 : 0
                const meta = getCategoryMeta(m.category)
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-background-secondary flex items-center justify-center text-[10px] font-medium text-foreground-muted flex-shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm text-foreground truncate">{m.name}</span>
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", meta.dotClass)} />
                        </div>
                        <span className="font-data text-sm font-medium text-foreground tabular-nums ml-2">
                          {formatCurrency(m.total)}
                        </span>
                      </div>
                      <div className="h-1 rounded-full bg-gray-200 dark:bg-background-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
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
            <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
              Largest Purchases
            </span>
            <div className="mt-4 space-y-3">
              {deep.largestPurchases.map((tx: any) => {
                const meta = getCategoryMeta(tx.category)
                return (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-card-border/50 last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", meta.dotClass)} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{tx.name}</p>
                        <p className="text-[10px] text-foreground-muted">{formatDateLabel(tx.date)}</p>
                      </div>
                    </div>
                    <span className="font-data text-sm font-semibold text-foreground tabular-nums ml-2">
                      {formatCurrency(tx.amount)}
                    </span>
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
  if (!patterns) return null

  return (
    <CollapsibleSection title="Spending by Day of Week" defaultOpen={false}>
      <div className="bg-card border border-card-border rounded-xl p-6">
        <div className="grid grid-cols-7 gap-2">
          {patterns.map((d) => {
            const maxDay = Math.max(...patterns.map((p) => p.total))
            const intensity = maxDay > 0 ? d.total / maxDay : 0
            return (
              <div key={d.day} className="text-center">
                <span className="text-[10px] font-medium text-foreground-muted block mb-2">{d.day}</span>
                <div
                  className="mx-auto w-full aspect-square rounded-lg flex items-center justify-center transition-colors"
                  style={{
                    backgroundColor: intensity > 0.75
                      ? "var(--error)"
                      : intensity > 0.5
                        ? "color-mix(in srgb, var(--warning) 60%, transparent)"
                        : intensity > 0.25
                          ? "color-mix(in srgb, var(--primary) 30%, transparent)"
                          : "var(--card-border)",
                  }}
                >
                  <span className="font-data text-[10px] font-medium tabular-nums text-foreground">
                    {formatCurrency(d.total)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </CollapsibleSection>
  )
}

export function InsightsAnomalies({ anomalies }: { anomalies: any[] | undefined }) {
  if (!anomalies || anomalies.length === 0) return null

  return (
    <div>
      <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-3 block">
        Unusual Spending
      </span>
      <div className="space-y-2">
        {anomalies.map((a) => (
          <InsightCard
            key={a.category}
            icon="notification_important"
            title={`${a.category}: ${a.multiplier.toFixed(1)}x your average`}
            description={`${formatCurrency(a.currentAmount)} this month vs ${formatCurrency(a.previousAmount)} last month.`}
            variant="danger"
          />
        ))}
      </div>
    </div>
  )
}
