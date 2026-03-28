"use client"

import { useState, useMemo } from "react"
import { getCategoryMeta, getBudgetableCategories } from "@/lib/finance/categories"
import { BudgetSparkline } from "./budget-sparkline"
import { formatCurrency, cn } from "@/lib/utils"

interface BudgetSuggestion { category: string; avgMonthly: number; lastMonth: number; monthsOfData: number; suggested: number }
interface TrendMonth { month: string; categories: Record<string, number> }

interface BudgetCreateModalProps {
  isOpen: boolean
  onClose: () => void
  existingBudgets: Array<{ id: string; category: string }> | undefined
  suggestions: BudgetSuggestion[] | undefined
  trendsData: { months: TrendMonth[] } | undefined
  onCreate: (category: string, monthlyLimit: number) => void
  isPending: boolean
}

export function BudgetCreateModal({ isOpen, onClose, existingBudgets, suggestions, trendsData, onCreate, isPending }: BudgetCreateModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedCategory, setSelectedCategory] = useState("")
  const [amount, setAmount] = useState("")

  const budgetedSet = useMemo(() => new Set(existingBudgets?.map((b) => b.category) ?? []), [existingBudgets])
  const allCategories = getBudgetableCategories()

  const selectedSuggestion = suggestions?.find((s) => s.category === selectedCategory)
  const selectedTrend = useMemo(() => {
    if (!selectedCategory || !trendsData) return []
    return trendsData.months.map((m) => m.categories[selectedCategory] ?? 0)
  }, [selectedCategory, trendsData])

  const suggestedAmount = selectedSuggestion?.suggested ?? 0
  const sliderMin = Math.max(10, Math.round(suggestedAmount * 0.3 / 10) * 10)
  const sliderMax = Math.max(suggestedAmount * 2, 500)
  const numAmount = parseFloat(amount) || 0

  const handleSelectCategory = (cat: string) => {
    setSelectedCategory(cat)
    const sug = suggestions?.find((s) => s.category === cat)
    setAmount(sug ? String(sug.suggested) : "")
    setStep(2)
  }

  const handleCreate = () => {
    if (!selectedCategory || !numAmount || numAmount <= 0) return
    onCreate(selectedCategory, numAmount)
    handleReset()
  }

  const handleReset = () => { setStep(1); setSelectedCategory(""); setAmount("") }
  const handleClose = () => { handleReset(); onClose() }

  if (!isOpen) return null

  const isBelowAvg = selectedSuggestion && numAmount > 0 && numAmount < selectedSuggestion.avgMonthly

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={handleClose}>
      <div className="bg-card border border-card-border w-full max-w-md rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button onClick={() => setStep(1)} className="p-0.5 rounded-md hover:bg-foreground/5 transition-colors">
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>arrow_back</span>
              </button>
            )}
            <h2 className="text-base font-semibold text-foreground">{step === 1 ? "Create Budget" : "Set Amount"}</h2>
          </div>
          <button onClick={handleClose} className="p-1 rounded-md hover:bg-foreground/5 transition-colors">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div className="p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <p className="text-xs text-foreground-muted">Choose a spending category to budget</p>
              <div className="grid grid-cols-3 gap-2">
                {allCategories.map((cat) => {
                  const meta = getCategoryMeta(cat)
                  const isBudgeted = budgetedSet.has(cat)
                  return (
                    <button key={cat} onClick={() => !isBudgeted && handleSelectCategory(cat)} disabled={isBudgeted} className={cn("flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center", isBudgeted ? "border-card-border opacity-40 cursor-not-allowed" : "border-card-border hover:border-primary hover:bg-primary/5 cursor-pointer")}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${meta.hex}20` }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 16, color: meta.hex }}>{isBudgeted ? "check" : meta.icon}</span>
                      </div>
                      <span className="text-[10px] font-medium text-foreground leading-tight">{cat}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {(() => {
                const meta = getCategoryMeta(selectedCategory)
                return (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${meta.hex}20` }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 20, color: meta.hex }}>{meta.icon}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{selectedCategory}</p>
                      {selectedSuggestion && (
                        <p className="text-[10px] text-foreground-muted tabular-nums">
                          avg {formatCurrency(selectedSuggestion.avgMonthly, "USD", 0)}/mo &middot; last month {formatCurrency(selectedSuggestion.lastMonth, "USD", 0)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })()}

              <div className="text-center">
                <div className="relative inline-flex items-center">
                  <span className="absolute left-3 text-lg text-foreground-muted font-data">$</span>
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40 text-center text-3xl font-data font-black tabular-nums bg-transparent border-b-2 border-card-border focus:border-primary py-2 text-foreground outline-none pl-7" style={{ letterSpacing: "-0.03em" }} placeholder="0" min={1} step={10} autoFocus />
                </div>
              </div>

              {suggestedAmount > 0 && (
                <input type="range" min={sliderMin} max={sliderMax} step={10} value={numAmount || suggestedAmount} onChange={(e) => setAmount(e.target.value)} className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-primary" style={{ background: `linear-gradient(to right, var(--primary) ${((numAmount - sliderMin) / (sliderMax - sliderMin)) * 100}%, var(--card-border) 0%)` }} />
              )}

              {selectedSuggestion && (
                <div className="flex flex-wrap gap-2 justify-center">
                  <Chip label={`Suggested ${formatCurrency(selectedSuggestion.suggested, "USD", 0)}`} active={numAmount === selectedSuggestion.suggested} onClick={() => setAmount(String(selectedSuggestion.suggested))} />
                  <Chip label={`6-mo avg ${formatCurrency(selectedSuggestion.avgMonthly, "USD", 0)}`} active={numAmount === Math.round(selectedSuggestion.avgMonthly)} onClick={() => setAmount(String(Math.round(selectedSuggestion.avgMonthly)))} />
                  <Chip label={`Last month ${formatCurrency(selectedSuggestion.lastMonth, "USD", 0)}`} active={numAmount === selectedSuggestion.lastMonth} onClick={() => setAmount(String(selectedSuggestion.lastMonth))} />
                </div>
              )}

              {selectedTrend.length > 0 && (
                <div className="flex items-center justify-center gap-2">
                  <TrendBars data={selectedTrend} color={getCategoryMeta(selectedCategory).hex} />
                  <span className="text-[9px] text-foreground-muted">{selectedTrend.filter((v) => v > 0).length} months of data</span>
                </div>
              )}

              {isBelowAvg && (
                <p className="text-[10px] text-warning text-center flex items-center justify-center gap-1">
                  <span className="material-symbols-rounded" style={{ fontSize: 12 }}>warning</span>
                  Below your average — you may exceed this limit
                </p>
              )}

              <button onClick={handleCreate} disabled={isPending || numAmount <= 0} className="w-full py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {isPending ? "Creating..." : "Create Budget"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TrendBars({ data, color }: { data: number[]; color: string }) {
  const last6 = data.slice(-6)
  if (last6.length === 0) return null
  const max = Math.max(...last6, 1)
  const barW = 8, gap = 3, h = 28, w = last6.length * (barW + gap) - gap
  return (
    <svg width={w} height={h}>
      {last6.map((val, i) => {
        const barH = Math.max((val / max) * h, 2)
        return <rect key={i} x={i * (barW + gap)} y={h - barH} width={barW} height={barH} rx={2} fill={color} opacity={i === last6.length - 1 ? 1 : 0.35} />
      })}
    </svg>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={cn("text-[10px] px-2.5 py-1 rounded-lg font-medium transition-colors", active ? "bg-primary/20 text-primary" : "bg-foreground/5 text-foreground-muted hover:text-foreground")}>{label}</button>
}
