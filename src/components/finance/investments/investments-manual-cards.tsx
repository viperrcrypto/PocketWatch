"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { getInvestmentTypeMeta } from "./investments-constants"

interface ManualCardsProps {
  manualAccounts: Array<{
    id: string; name: string; subtype: string | null; currentBalance: number | null
  }>
  editingId: string | null
  editValue: string
  deletingId: string | null
  showAddForm: boolean
  onEditStart: (id: string, value: number) => void
  onEditChange: (value: string) => void
  onEditSubmit: (id: string) => void
  onEditCancel: () => void
  onDelete: (id: string, name: string) => void
  onShowAdd: () => void
  updatePending: boolean
}

export function InvestmentsManualCards({
  manualAccounts, editingId, editValue, deletingId, showAddForm,
  onEditStart, onEditChange, onEditSubmit, onEditCancel, onDelete, onShowAdd, updatePending,
}: ManualCardsProps) {
  if (manualAccounts.length === 0 && !showAddForm) {
    return (
      <button onClick={onShowAdd} className="w-full border-2 border-dashed border-card-border rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-foreground-muted hover:text-foreground hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-200">
        <span className="material-symbols-rounded" style={{ fontSize: 32 }}>add_chart</span>
        <span className="text-sm font-medium">Add your first manual investment</span>
        <span className="text-xs">Track real estate, stocks, crypto, and more</span>
      </button>
    )
  }

  if (manualAccounts.length === 0) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {manualAccounts.map((acct) => {
        const meta = getInvestmentTypeMeta(acct.subtype)
        return (
          <div key={acct.id} className="group bg-card border border-card-border rounded-xl p-4 hover:border-card-border-hover transition-all duration-200" style={{ borderLeft: `3px solid ${meta.color}` }}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color: meta.color }}>{meta.icon}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{acct.name}</p>
                  <span className="px-1.5 py-0.5 text-[9px] font-medium uppercase rounded" style={{ backgroundColor: `${meta.color}15`, color: meta.color }}>{meta.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEditStart(acct.id, acct.currentBalance ?? 0)}
                  className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors" title="Edit value">
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>edit</span>
                </button>
                <button onClick={() => onDelete(acct.id, acct.name)}
                  disabled={deletingId === acct.id} className="p-1.5 rounded-lg text-foreground-muted hover:text-error hover:bg-error/5 transition-colors" title="Delete">
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span>
                </button>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-card-border/30">
              {editingId === acct.id ? (
                <div className="flex items-center gap-2">
                  <input type="number" value={editValue} onChange={(e) => onEditChange(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 text-sm font-data tabular-nums border border-card-border rounded-lg bg-background text-foreground focus:outline-none focus:border-primary/50"
                    autoFocus onKeyDown={(e) => { if (e.key === "Enter") onEditSubmit(acct.id); if (e.key === "Escape") onEditCancel() }} />
                  <button onClick={() => onEditSubmit(acct.id)} disabled={updatePending} className="p-1.5 text-success hover:text-success/80">
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>check</span>
                  </button>
                  <button onClick={onEditCancel} className="p-1.5 text-foreground-muted hover:text-foreground">
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-baseline justify-between">
                  <span className="font-data text-lg font-bold text-foreground tabular-nums">{formatCurrency(acct.currentBalance ?? 0)}</span>
                  <span className="text-[10px] text-foreground-muted">Manual</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
      {!showAddForm && (
        <button onClick={onShowAdd} className="border-2 border-dashed border-card-border rounded-xl p-4 flex flex-col items-center justify-center gap-2 min-h-[130px] text-foreground-muted hover:text-foreground hover:border-primary/30 hover:bg-primary/[0.02] transition-all duration-200">
          <span className="material-symbols-rounded" style={{ fontSize: 24 }}>add_circle</span>
          <span className="text-xs font-medium">Add Investment</span>
        </button>
      )}
    </div>
  )
}
