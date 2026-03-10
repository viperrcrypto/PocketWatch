"use client"

import { useMemo } from "react"
import Link from "next/link"
import type { UseMutationResult } from "@tanstack/react-query"
import { formatCurrency, cn } from "@/lib/utils"
import type { AIInsightsData } from "@/hooks/use-finance"
import { InvestmentAllocationChart } from "@/components/finance/investment-allocation-chart"
import { InstitutionLogo } from "@/components/finance/institution-logo"
import { getInvestmentTypeMeta } from "./investments-constants"
import { formatRelativeTime, getSyncStatus } from "./investments-helpers"

// ─── Types ──────────────────────────────────────────────────────

interface Holding {
  institutionValue: number | null
  accountName: string | null
  security: {
    name: string | null
    type: string | null
    sector: string | null
  } | null
}

interface ManualAccount {
  id: string
  name: string
  subtype: string | null
  currentBalance: number | null
}

interface Institution {
  id: string
  institutionName: string
  institutionLogo: string | null
  lastSyncedAt: string | null
  accounts: Array<{ currentBalance: number | null }>
}

interface Props {
  holdings: Holding[] | undefined
  totalValue: number
  manualAccounts: ManualAccount[]
  aiData: AIInsightsData | undefined
  generateInsights: UseMutationResult<AIInsightsData, Error, { force?: boolean } | undefined>
  connected: Institution[]
}

// ─── Component ──────────────────────────────────────────────────

export function InvestmentsSidebar({
  holdings, totalValue, manualAccounts, aiData, generateInsights, connected,
}: Props) {
  return (
    <div className="space-y-4">
      {/* ── Allocation ── */}
      <AllocationSection holdings={holdings} totalValue={totalValue} manualAccounts={manualAccounts} />

      {/* ── AI Insights ── */}
      <AIInsightsSection aiData={aiData} generateInsights={generateInsights} />

      {/* ── Connected Accounts ── */}
      {connected.length > 0 && <ConnectedAccountsSection connected={connected} />}
    </div>
  )
}

// ─── Allocation Section ─────────────────────────────────────────

function AllocationSection({ holdings, totalValue, manualAccounts }: {
  holdings: Holding[] | undefined
  totalValue: number
  manualAccounts: ManualAccount[]
}) {
  const manualSegments = useMemo(() =>
    manualAccounts
      .filter((a) => (a.currentBalance ?? 0) > 0)
      .map((a) => {
        const meta = getInvestmentTypeMeta(a.subtype)
        return {
          name: a.name,
          value: a.currentBalance ?? 0,
          pct: totalValue > 0 ? ((a.currentBalance ?? 0) / totalValue) * 100 : 0,
          color: meta.color,
          icon: meta.icon,
        }
      })
      .sort((a, b) => b.value - a.value),
    [manualAccounts, totalValue]
  )

  // Check if one asset type dominates (>90% of portfolio)
  const dominantType = useMemo(() => {
    if (!holdings || holdings.length === 0) return false
    const byType = new Map<string, number>()
    for (const h of holdings) {
      if (h.institutionValue == null || h.institutionValue <= 0) continue
      const type = h.security?.type?.toLowerCase() ?? "other"
      byType.set(type, (byType.get(type) ?? 0) + h.institutionValue)
    }
    for (const [, val] of byType) {
      if (totalValue > 0 && (val / totalValue) * 100 > 90) return true
    }
    return false
  }, [holdings, totalValue])

  // Per-account breakdown from holdings
  const accountSegments = useMemo(() => {
    if (!holdings || holdings.length === 0) return []
    const byAccount = new Map<string, number>()
    for (const h of holdings) {
      if (h.institutionValue == null || h.institutionValue <= 0) continue
      const acctName = h.accountName ?? "Unknown Account"
      byAccount.set(acctName, (byAccount.get(acctName) ?? 0) + h.institutionValue)
    }
    const ACCOUNT_COLORS = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b"]
    return Array.from(byAccount.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({
        name,
        value,
        pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      }))
  }, [holdings, totalValue])

  if (holdings && holdings.length > 0) {
    return (
      <div className="space-y-4">
        {/* Show donut when there's real type diversity, otherwise skip it */}
        {!dominantType && (
          <InvestmentAllocationChart holdings={holdings} totalValue={totalValue} compact />
        )}

        {/* Per-account breakdown — always show when multiple accounts */}
        {accountSegments.length > 1 && (
          <div className="bg-card border border-card-border rounded-xl p-5">
            <h3 className="text-xs font-semibold text-foreground mb-3">By Account</h3>
            <div className="space-y-2.5">
              {accountSegments.map((s) => (
                <div key={s.name} className="flex items-center gap-2.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-0.5">
                      <span className="text-[11px] font-medium text-foreground truncate">{s.name}</span>
                      <span className="text-[10px] font-semibold font-data tabular-nums text-foreground ml-2">{formatCurrency(s.value)}</span>
                    </div>
                    <div className="h-1 bg-background-secondary rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                    </div>
                  </div>
                  <span className="text-[9px] text-foreground-muted font-data tabular-nums w-10 text-right">
                    {s.pct < 1 ? s.pct.toFixed(2) : s.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (manualSegments.length > 0) {
    return (
      <div className="bg-card border border-card-border rounded-xl p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Portfolio Breakdown</h3>
        <div className="space-y-3">
          {manualSegments.map((s) => (
            <div key={s.name} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.color}15` }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14, color: s.color }}>{s.icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                  <span className="text-[10px] font-semibold font-data tabular-nums text-foreground ml-2">{formatCurrency(s.value)}</span>
                </div>
                <div className="h-1 bg-background-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                </div>
              </div>
              <span className="text-[10px] text-foreground-muted font-data tabular-nums w-8 text-right">{s.pct.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  return (
    <div className="bg-card border border-card-border rounded-xl p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
      <span className="material-symbols-rounded text-foreground-muted/30 mb-3" style={{ fontSize: 36 }}>pie_chart</span>
      <p className="text-sm font-medium text-foreground mb-1">No allocation data</p>
      <p className="text-xs text-foreground-muted max-w-[200px]">Connect a brokerage to see your portfolio breakdown</p>
    </div>
  )
}

// ─── AI Insights Section ────────────────────────────────────────

function AIInsightsSection({ aiData, generateInsights }: {
  aiData: AIInsightsData | undefined
  generateInsights: UseMutationResult<AIInsightsData, Error, { force?: boolean } | undefined>
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>auto_awesome</span>
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Insights</span>
        </div>
        <button
          onClick={() => generateInsights.mutate({ force: true })}
          disabled={generateInsights.isPending}
          className="p-1 rounded text-foreground-muted hover:text-foreground transition-colors"
          aria-label="Refresh insights"
        >
          <span className={cn("material-symbols-rounded", generateInsights.isPending && "animate-spin")} style={{ fontSize: 14 }}>
            {generateInsights.isPending ? "progress_activity" : "refresh"}
          </span>
        </button>
      </div>

      {aiData?.insights ? (
        <div className="divide-y divide-card-border/30">
          {/* Key Insight */}
          <div className="p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">Key Insight</span>
            </div>
            <p className="text-xs font-semibold text-foreground mb-1">{aiData.insights.keyInsight.title}</p>
            <p className="text-[11px] text-foreground-muted leading-relaxed">{aiData.insights.keyInsight.description}</p>
          </div>

          {/* Savings Opportunities */}
          {aiData.insights.savingsOpportunities.slice(0, 2).map((opp) => (
            <div key={opp.area} className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[9px] font-bold bg-success/10 text-success px-1.5 py-0.5 rounded uppercase">Savings</span>
              </div>
              <p className="text-xs font-semibold text-foreground mb-1">{opp.area}</p>
              <p className="text-[11px] text-foreground-muted leading-relaxed">{opp.description}</p>
              {opp.estimatedSavings > 0 && (
                <p className="text-[11px] font-semibold text-success mt-1">Est. savings: {formatCurrency(opp.estimatedSavings)}</p>
              )}
            </div>
          ))}

          {/* Action Items */}
          {aiData.insights.actionItems.slice(0, 2).map((item) => (
            <div key={`${item.priority}-${item.action}`} className="p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <span className={cn(
                  "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase",
                  item.priority === "high" ? "bg-error/10 text-error" :
                  item.priority === "medium" ? "bg-warning/10 text-warning" :
                  "bg-info/10 text-info"
                )}>
                  {item.priority}
                </span>
              </div>
              <p className="text-[11px] text-foreground leading-relaxed">{item.action}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 text-center">
          <span className="material-symbols-rounded text-foreground-muted/30 block mb-2" style={{ fontSize: 24 }}>auto_awesome</span>
          <p className="text-xs text-foreground-muted mb-3">Generate AI-powered portfolio insights</p>
          <button
            onClick={() => generateInsights.mutate({})}
            disabled={generateInsights.isPending}
            className="w-full px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {generateInsights.isPending ? "Generating..." : "Generate Insights"}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Connected Accounts Section ─────────────────────────────────

function ConnectedAccountsSection({ connected }: { connected: Institution[] }) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border/50">
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Accounts</span>
        <Link href="/finance/accounts" className="text-[10px] text-primary hover:text-primary/80 font-medium">
          Manage
        </Link>
      </div>
      <div className="divide-y divide-card-border/30">
        {connected.map((inst) => (
          <div key={inst.id} className="flex items-center gap-2.5 px-4 py-2.5">
            <InstitutionLogo src={inst.institutionLogo} size={7} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{inst.institutionName}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <div className={cn("w-1 h-1 rounded-full", getSyncStatus(inst.lastSyncedAt).color)} />
                <p className="text-[9px] text-foreground-muted">{formatRelativeTime(inst.lastSyncedAt)}</p>
              </div>
            </div>
            <span className="font-data text-xs font-semibold text-foreground tabular-nums">
              {formatCurrency(inst.accounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
