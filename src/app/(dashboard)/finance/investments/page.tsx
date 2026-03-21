"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  useInvestments, useCreateInvestment, useUpdateInvestment, useDeleteInvestment,
  useInvestmentHoldings, useInvestmentTransactions, useInvestmentHistory,
  useAIInsights, useGenerateAIInsights, useResyncPlaidData,
} from "@/hooks/use-finance"
import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import dynamic from "next/dynamic"
const NetWorthChart = dynamic(
  () => import("@/components/finance/net-worth-chart").then((m) => m.NetWorthChart),
  { ssr: false, loading: () => <div className="h-[280px] animate-shimmer rounded-xl" /> }
)
import { ConfirmDialog } from "@/components/finance/confirm-dialog"

import { CHART_RANGES, RANGE_MAP, TX_TYPE_TABS } from "@/components/finance/investments/investments-constants"
import { InvestmentsAddForm } from "@/components/finance/investments/investments-add-form"
import { InvestmentsTransactionList } from "@/components/finance/investments/investments-transaction-list"
import { InvestmentsManualCards } from "@/components/finance/investments/investments-manual-cards"
import { InvestmentsSidebar } from "@/components/finance/investments/investments-sidebar"
import { InvestmentHoldingsTable } from "@/components/finance/investment-holdings-table"

function formatTimeAgo(date: Date): string {
  const ms = Date.now() - date.getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return "just now"
  if (min < 60) return `${min}m ago`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function InvestmentsPage() {
  const { data, isLoading, isError } = useInvestments()
  const resync = useResyncPlaidData()
  const createInvestment = useCreateInvestment()
  const updateInvestment = useUpdateInvestment()
  const deleteInvestment = useDeleteInvestment()

  const [showAddForm, setShowAddForm] = useState(false)
  const [formName, setFormName] = useState("")
  const [formValue, setFormValue] = useState("")
  const [formType, setFormType] = useState("stocks")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [invTxPage, setInvTxPage] = useState(1)
  const [invTxType, setInvTxType] = useState("")
  const [chartRange, setChartRange] = useState<string>("1M")

  const { data: holdingsData } = useInvestmentHoldings()
  const { data: invTxData } = useInvestmentTransactions({ page: invTxPage, type: invTxType || undefined })
  const { data: invHistory, isLoading: invHistoryLoading } = useInvestmentHistory(RANGE_MAP[chartRange] ?? "1m")
  const { data: aiData } = useAIInsights()
  const generateInsights = useGenerateAIInsights()

  const institutions = data?.institutions ?? []
  const totalValue = data?.totalValue ?? 0

  const { connected, manualAccounts } = useMemo(() => {
    const conn = institutions.filter((i) => i.provider !== "manual")
    const man = institutions.filter((i) => i.provider === "manual")
    return { connected: conn, manualAccounts: man.flatMap((i) => i.accounts) }
  }, [institutions])

  const lastSyncedAt = useMemo(() => {
    const dates = institutions
      .filter((i) => i.provider !== "manual" && i.lastSyncedAt)
      .map((i) => new Date(i.lastSyncedAt!).getTime())
    if (dates.length === 0) return null
    return new Date(Math.max(...dates))
  }, [institutions])

  const stats = useMemo(() => {
    const holdings = holdingsData?.holdings ?? []
    let totalGainLoss = 0; let hasGainLoss = false; let totalCostBasis = 0
    for (const h of holdings) {
      if (h.institutionValue != null && h.costBasis != null) {
        totalGainLoss += h.institutionValue - h.costBasis
        totalCostBasis += Math.abs(h.costBasis)
        hasGainLoss = true
      }
    }
    const gainPct = hasGainLoss && totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : null
    return { holdingsCount: holdings.length, totalGainLoss: hasGainLoss ? totalGainLoss : null, gainPct, totalCostBasis: hasGainLoss ? totalCostBasis : null }
  }, [holdingsData])

  const investmentChartData = useMemo(() => {
    const syntheticYesterday = (dateStr: string) => {
      const d = new Date(dateStr)
      d.setDate(d.getDate() - 1)
      return d.toISOString().slice(0, 10)
    }
    const padSingle = (entries: { date: string; fiatNetWorth: number; totalNetWorth: number; annotation?: string }[]) => {
      if (entries.length === 1) {
        return [{ ...entries[0], date: syntheticYesterday(entries[0].date) }, entries[0]]
      }
      return entries
    }

    if (invHistory?.entries && invHistory.entries.length >= 1) {
      const mapped = invHistory.entries.map((e) => ({
        date: e.date,
        fiatNetWorth: e.totalValue,
        totalNetWorth: e.totalValue,
        ...(e.annotation ? { annotation: e.annotation } : {}),
      }))
      return padSingle(mapped)
    }
    return null
  }, [invHistory])

  // Use cost-basis P&L for chart header (same as the P&L stat card)
  // This avoids showing fake gains when new accounts are added mid-chart
  const invDelta = stats.totalGainLoss ?? 0
  const invPct = stats.gainPct ?? 0

  const handleCreate = () => {
    const value = parseFloat(formValue)
    if (!formName.trim() || isNaN(value) || value < 0) return
    createInvestment.mutate({ name: formName.trim(), value, type: formType }, {
      onSuccess: () => { setFormName(""); setFormValue(""); setFormType("stocks"); setShowAddForm(false) },
    })
  }

  const handleUpdate = (accountId: string) => {
    const value = parseFloat(editValue)
    if (isNaN(value) || value < 0) return
    updateInvestment.mutate({ accountId, value }, { onSuccess: () => setEditingId(null) })
  }

  // ─── Error State ───
  if (isError && institutions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Investments</h1>
        <div className="bg-card border border-error/30 rounded-xl p-8 text-center">
          <span className="material-symbols-rounded text-error mb-2 block" style={{ fontSize: 32 }}>error</span>
          <p className="text-sm text-error">Failed to load investment data. Please try again.</p>
        </div>
      </div>
    )
  }

  // ─── Empty State ───
  if (!isLoading && institutions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-black tracking-tight text-foreground">Investments</h1>
        <div className="bg-card border border-card-border rounded-xl py-16 px-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 36 }}>trending_up</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Track All Your Investments</h2>
          <p className="text-sm text-foreground-muted max-w-md mx-auto mb-10 leading-relaxed">
            Monitor your portfolio performance, asset allocation, and investment growth across all your accounts in one place.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto mb-10">
            {[
              { icon: "link", title: "Connect Brokerage", desc: "Link via Plaid or SimpleFIN for automatic syncing" },
              { icon: "edit_note", title: "Add Manual Entry", desc: "Track stocks, real estate, crypto, and more" },
              { icon: "insights", title: "Track Performance", desc: "Charts, gains/losses, and allocation analysis" },
            ].map((feat) => (
              <div key={feat.title} className="bg-background-secondary/50 rounded-xl p-5 text-left">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>{feat.icon}</span>
                </div>
                <h4 className="text-sm font-semibold text-foreground mb-1">{feat.title}</h4>
                <p className="text-xs text-foreground-muted leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/finance/accounts" className="inline-flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>link</span>Connect Account
            </Link>
            <button onClick={() => setShowAddForm(true)} className="inline-flex items-center gap-2 px-6 py-3 border border-card-border rounded-xl text-sm font-medium text-foreground hover:bg-background-secondary transition-colors">
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>Add Manually
            </button>
          </div>
        </div>
        {showAddForm && (
          <InvestmentsAddForm formName={formName} formValue={formValue} formType={formType} isPending={createInvestment.isPending}
            onNameChange={setFormName} onValueChange={setFormValue} onTypeChange={setFormType} onSubmit={handleCreate} onCancel={() => setShowAddForm(false)} />
        )}
      </div>
    )
  }

  // ─── Main Content ───
  const connectedAccountCount = connected.reduce((s, i) => s + i.accounts.length, 0)
  const totalAccounts = connectedAccountCount + manualAccounts.length
  const isGain = stats.totalGainLoss != null && stats.totalGainLoss >= 0
  const now = new Date()

  return (
    <div className="space-y-5">
      {/* ── Header: Title + Summary Cards ── */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Investments</h1>
          <p className="text-foreground-muted text-sm mt-0.5">
            {isLoading ? "Loading..." : `${formatCurrency(totalValue)} across ${totalAccounts} account${totalAccounts !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {/* P&L Card */}
          <div className="bg-card border border-card-border rounded-xl px-5 py-4 min-w-[150px]">
            <div className="flex items-center gap-2 mb-2">
              <div className={cn("size-7 rounded-lg flex items-center justify-center border", isGain ? "bg-success-muted border-success/20" : "bg-error-muted border-error/20")}>
                <span className={cn("material-symbols-rounded", isGain ? "text-success" : "text-error")} style={{ fontSize: 14 }}>
                  {isGain ? "trending_up" : "trending_down"}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">P&L</span>
            </div>
            <div className={cn("text-xl font-black font-data tabular-nums", isGain ? "text-success" : "text-error")}>
              {stats.totalGainLoss != null ? `${isGain ? "+" : ""}${formatCurrency(stats.totalGainLoss)}` : "--"}
            </div>
            <div className="text-[10px] text-foreground-muted mt-0.5 whitespace-nowrap">
              {stats.gainPct != null ? (() => { const pct = Math.abs(stats.gainPct) < 0.05 ? 0 : stats.gainPct; return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% return` })() : "No cost basis data"}
            </div>
          </div>
          {/* Holdings Card */}
          <div className="bg-card border border-card-border rounded-xl px-5 py-4 min-w-[150px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="size-7 rounded-lg bg-primary-muted flex items-center justify-center border border-primary/20">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 14 }}>show_chart</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-foreground-muted">Holdings</span>
            </div>
            <div className="text-xl font-black font-data tabular-nums text-foreground">{stats.holdingsCount}</div>
            <div className="text-[10px] text-foreground-muted mt-0.5">
              {connectedAccountCount > 0 ? `${connectedAccountCount} linked` : ""}{connectedAccountCount > 0 && manualAccounts.length > 0 ? " · " : ""}{manualAccounts.length > 0 ? `${manualAccounts.length} manual` : ""}
            </div>
          </div>
          {/* Date Widget */}
          <div className="bg-card border border-card-border rounded-xl px-5 py-4 flex flex-col items-center justify-center min-w-[90px]">
            <span className="text-primary text-[11px] font-black uppercase tracking-wider">{now.toLocaleDateString("en-US", { month: "short" })}</span>
            <span className="text-3xl font-black text-foreground leading-none mt-1">{now.getDate()}</span>
            <span className="text-[10px] text-foreground-muted font-bold mt-1">{now.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
          </div>
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {lastSyncedAt && (
          <span className="text-[10px] text-foreground-muted mr-1">
            Synced {formatTimeAgo(lastSyncedAt)}
          </span>
        )}
        <button
          onClick={() => resync.mutate(undefined, {
            onSuccess: () => toast.success("Investments synced"),
            onError: (err) => toast.error(err.message),
          })}
          disabled={resync.isPending}
          className="text-foreground-muted text-xs font-bold px-3 py-2 rounded-lg hover:text-foreground hover:bg-background-secondary transition-all border border-card-border flex items-center gap-1.5 disabled:opacity-50"
        >
          <span className={cn("material-symbols-rounded", resync.isPending && "animate-spin")} style={{ fontSize: 14 }}>sync</span>
          {resync.isPending ? "Syncing..." : "Sync"}
        </button>
        <Link href="/finance/accounts" className="text-foreground-muted text-xs font-bold px-3 py-2 rounded-lg hover:text-foreground hover:bg-background-secondary transition-all border border-card-border flex items-center gap-1.5">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>link</span>Connect
        </Link>
        <button onClick={() => setShowAddForm(true)} className="text-primary text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 border border-primary/30 hover:bg-primary hover:text-white transition-all">
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>Add Entry
        </button>
      </div>

      {/* ── Main + Sidebar Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
          <div className="space-y-6">
            <div className="h-[360px] animate-shimmer rounded-xl" />
            <div className="h-[300px] animate-shimmer rounded-xl" />
          </div>
          <div className="space-y-4">
            <div className="h-[300px] animate-shimmer rounded-xl" />
            <div className="h-[200px] animate-shimmer rounded-xl" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
          {/* ── Main Column ── */}
          <div className="space-y-6 min-w-0">
            {/* Portfolio Performance Chart */}
            <div className="bg-card border border-card-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>show_chart</span>
                  <span className="text-sm font-semibold text-foreground">Portfolio Performance</span>
                  {investmentChartData && invDelta !== 0 && (
                    <span className={cn("text-xs font-bold font-data tabular-nums", invDelta >= 0 ? "text-success" : "text-error")}>
                      {invPct !== 0 && <>{invPct >= 0 ? "+" : ""}{invPct.toFixed(1)}% </>}
                      ({invDelta >= 0 ? "+" : "-"}{formatCurrency(Math.abs(invDelta))})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {CHART_RANGES.map((r) => (
                    <button key={r} onClick={() => setChartRange(r)}
                      className={cn("px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-colors",
                        chartRange === r ? "bg-primary text-white" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-5">
                {invHistoryLoading ? <div className="h-[200px] animate-shimmer rounded-lg" /> :
                  investmentChartData ? (
                    <>
                      <NetWorthChart data={investmentChartData} range={RANGE_MAP[chartRange] ?? "1m"} height={280} />
                      {invHistory?.entries && invHistory.entries.length === 1 && (
                        <p className="text-[10px] text-foreground-muted/60 text-center mt-2">Portfolio tracking started today. Performance history builds automatically with each sync.</p>
                      )}
                    </>
                  ) : (
                    <div className="h-[120px] flex flex-col items-center justify-center text-center">
                      <span className="material-symbols-rounded text-foreground-muted/30 mb-2" style={{ fontSize: 28 }}>show_chart</span>
                      <p className="text-xs text-foreground-muted">Not enough history for this range</p>
                      <p className="text-[10px] text-foreground-muted/60 mt-0.5">Try a longer range or wait for more syncs</p>
                    </div>
                  )}
              </div>
            </div>

            {/* Holdings Table */}
            {holdingsData && holdingsData.holdings.length > 0 ? (
              <InvestmentHoldingsTable holdings={holdingsData.holdings} totalValue={holdingsData.totalValue} />
            ) : (
              <div className="bg-card border border-card-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-card-border/50">
                  <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>show_chart</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Investment Holdings</span>
                </div>
                <div className="py-16 text-center">
                  <span className="material-symbols-rounded text-foreground-muted/30 block mb-2" style={{ fontSize: 32 }}>inventory_2</span>
                  <p className="text-sm text-foreground-muted">No holdings data yet</p>
                  <p className="text-xs text-foreground-muted/60 mt-1">Connect a brokerage to see individual positions</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <InvestmentsSidebar
            holdings={holdingsData?.holdings}
            totalValue={holdingsData?.totalValue ?? totalValue}
            manualAccounts={manualAccounts}
            aiData={aiData}
            generateInsights={generateInsights}
            connected={connected}
          />
        </div>
      )}

      {/* ── Manual Investments (full width, below grid) ── */}
      {!isLoading && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Manual Investments</h3>
            {!showAddForm && (
              <button onClick={() => setShowAddForm(true)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors">
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>Add Entry
              </button>
            )}
          </div>
          {showAddForm && (
            <InvestmentsAddForm formName={formName} formValue={formValue} formType={formType} isPending={createInvestment.isPending}
              onNameChange={setFormName} onValueChange={setFormValue} onTypeChange={setFormType} onSubmit={handleCreate} onCancel={() => setShowAddForm(false)} />
          )}
          <InvestmentsManualCards
            manualAccounts={manualAccounts} editingId={editingId} editValue={editValue} deletingId={deletingId} showAddForm={showAddForm}
            onEditStart={(id, val) => { setEditingId(id); setEditValue(String(val)) }}
            onEditChange={setEditValue} onEditSubmit={handleUpdate} onEditCancel={() => setEditingId(null)}
            onDelete={(id, name) => setDeleteTarget({ id, name })}
            onShowAdd={() => setShowAddForm(true)} updatePending={updateInvestment.isPending}
          />
        </div>
      )}

      {/* ── Investment Transactions (full width, below grid) ── */}
      {!isLoading && invTxData && invTxData.transactions.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3 border-b border-card-border/50">
            <div className="flex items-center gap-2">
              <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>swap_vert</span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Investment Transactions</span>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto">
              {TX_TYPE_TABS.map((tab) => (
                <button key={tab.value} onClick={() => { setInvTxType(tab.value); setInvTxPage(1) }}
                  className={cn("px-2.5 py-1 text-[10px] font-medium rounded-md whitespace-nowrap transition-all duration-200",
                    invTxType === tab.value ? "bg-foreground text-background" : "text-foreground-muted hover:text-foreground hover:bg-background-secondary")}>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <InvestmentsTransactionList transactions={invTxData.transactions} />
          {invTxData.pagination?.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-card-border/50 bg-background-secondary/20">
              <span className="text-[10px] text-foreground-muted">{invTxData.pagination.total} total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setInvTxPage((p) => Math.max(1, p - 1))} disabled={invTxPage <= 1}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border disabled:opacity-30 hover:bg-background-secondary transition-colors">Previous</button>
                <span className="text-xs text-foreground-muted tabular-nums font-data">{invTxPage} / {invTxData.pagination.totalPages}</span>
                <button onClick={() => setInvTxPage((p) => p + 1)} disabled={invTxPage >= invTxData.pagination.totalPages}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-card-border disabled:opacity-30 hover:bg-background-secondary transition-colors">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* ── Delete Confirmation ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            setDeletingId(deleteTarget.id)
            deleteInvestment.mutate(deleteTarget.id, { onSettled: () => { setDeletingId(null); setDeleteTarget(null) } })
          }
        }}
        title={`Delete "${deleteTarget?.name ?? ""}"?`}
        description="This will permanently remove this manual investment entry."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleteInvestment.isPending}
      />
    </div>
  )
}
