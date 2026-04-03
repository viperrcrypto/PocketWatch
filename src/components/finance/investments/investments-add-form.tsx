"use client"

import { cn } from "@/lib/utils"
import { INVESTMENT_TYPE_OPTIONS, getInvestmentTypeMeta } from "./investments-constants"

interface AddManualFormProps {
  formName: string
  formValue: string
  formType: string
  formApy: string
  formYieldType: string
  isPending: boolean
  onNameChange: (v: string) => void
  onValueChange: (v: string) => void
  onTypeChange: (v: string) => void
  onApyChange: (v: string) => void
  onYieldTypeChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
}

export function InvestmentsAddForm({
  formName, formValue, formType, formApy, formYieldType, isPending,
  onNameChange, onValueChange, onTypeChange, onApyChange, onYieldTypeChange, onSubmit, onCancel,
}: AddManualFormProps) {
  const isYieldType = formType === "yield"
  const selectedMeta = getInvestmentTypeMeta(formType)
  return (
    <div className="bg-card border border-primary/20 rounded-xl p-5 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${selectedMeta.color}15` }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, color: selectedMeta.color }}>{selectedMeta.icon}</span>
          </div>
          <h4 className="text-sm font-semibold text-foreground">Add Manual Investment</h4>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors">
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {INVESTMENT_TYPE_OPTIONS.map((opt) => (
          <button key={opt.value} onClick={() => onTypeChange(opt.value)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-200",
              formType === opt.value ? "border-transparent shadow-sm" : "border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover"
            )}
            style={formType === opt.value ? { backgroundColor: `${opt.color}15`, color: opt.color, borderColor: `${opt.color}30` } : undefined}>
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{opt.icon}</span>
            {opt.label}
          </button>
        ))}
      </div>
      <div className={cn("grid gap-3", isYieldType ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
        <div>
          <label className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1 block">Name</label>
          <input type="text" value={formName} onChange={(e) => onNameChange(e.target.value)} placeholder={isYieldType ? "e.g. Galaxy Premium Yield" : "e.g. Robinhood — AAPL"}
            className="w-full px-3 py-2.5 text-sm border border-card-border rounded-lg bg-background text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        <div>
          <label className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1 block">{isYieldType ? "Principal ($)" : "Current Value ($)"}</label>
          <input type="number" value={formValue} onChange={(e) => onValueChange(e.target.value)} placeholder="0.00" min="0" step="0.01"
            className="w-full px-3 py-2.5 text-sm font-data tabular-nums border border-card-border rounded-lg bg-background text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary/50 transition-colors" />
        </div>
        {isYieldType && (
          <>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1 block">APY (%)</label>
              <input type="number" value={formApy} onChange={(e) => onApyChange(e.target.value)} placeholder="8.00" min="0" max="100" step="0.01"
                className="w-full px-3 py-2.5 text-sm font-data tabular-nums border border-card-border rounded-lg bg-background text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary/50 transition-colors" />
            </div>
            <div>
              <label className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted mb-1 block">Rate Type</label>
              <div className="flex gap-1.5">
                {(["fixed", "variable"] as const).map((t) => (
                  <button key={t} onClick={() => onYieldTypeChange(t)}
                    className={cn("flex-1 px-3 py-2.5 text-xs font-medium rounded-lg border transition-colors",
                      formYieldType === t ? "border-primary/30 bg-primary/10 text-primary" : "border-card-border text-foreground-muted hover:text-foreground"
                    )}>
                    {t === "fixed" ? "Fixed" : "Variable"}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={onSubmit} disabled={isPending || !formName.trim() || !formValue}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
          {isPending ? (<><span className="material-symbols-rounded animate-spin" style={{ fontSize: 14 }}>progress_activity</span>Adding...</>)
            : (<><span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>Add Investment</>)}
        </button>
      </div>
    </div>
  )
}
