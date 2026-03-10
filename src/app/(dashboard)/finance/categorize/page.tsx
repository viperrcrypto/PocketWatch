"use client"

import { useState, useCallback, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  useUncategorizedTransactions, useUpdateTransactionCategory,
  useAICategorize, useApplyAISuggestions,
} from "@/hooks/use-finance"
import { cn } from "@/lib/utils"
import { CategorizeCard } from "@/components/finance/categorize-card"
import { CategorySuggestions } from "@/components/finance/category-suggestions"
import { CategoryPicker } from "@/components/finance/category-picker"
import { AICategorizePreview } from "@/components/finance/ai-categorize-preview"
import { CategorizeAuditMode } from "@/components/finance/categorize-audit-mode"
import { toast } from "sonner"

type PageMode = "quick" | "ai" | "audit"

export default function CategorizePage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawMode = searchParams.get("mode")
  const mode: PageMode = rawMode === "ai" ? "ai" : rawMode === "audit" ? "audit" : "quick"

  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [nickname, setNickname] = useState("")
  const [createRule, setCreateRule] = useState(true)
  const [categorizedCount, setCategorizedCount] = useState(0)

  const { data, isLoading, refetch } = useUncategorizedTransactions()
  const updateCategory = useUpdateTransactionCategory()
  const aiCategorize = useAICategorize()
  const applyAI = useApplyAISuggestions()

  const transactions = data?.transactions ?? []
  const total = data?.total ?? 0
  const currentTx = transactions[currentIndex]

  // Reset nickname when transaction changes
  useEffect(() => {
    setNickname(currentTx?.cleanedName ?? "")
  }, [currentTx?.id, currentTx?.cleanedName])

  const advanceToNext = useCallback(() => {
    setSelectedCategory(null)
    setSelectedSubcategory(null)
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      refetch()
      setCurrentIndex(0)
    }
  }, [currentIndex, transactions.length, refetch])

  const handleConfirm = useCallback(() => {
    if (!currentTx || !selectedCategory) return
    const trimmedNickname = nickname.trim()
    const nicknameChanged = trimmedNickname !== currentTx.cleanedName

    updateCategory.mutate(
      {
        transactionId: currentTx.id,
        category: selectedCategory,
        subcategory: selectedSubcategory ?? undefined,
        nickname: nicknameChanged ? trimmedNickname : undefined,
        createRule,
      },
      {
        onSuccess: () => {
          setCategorizedCount((c) => c + 1)
          advanceToNext()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }, [currentTx, selectedCategory, selectedSubcategory, nickname, createRule, updateCategory, advanceToNext])

  const handleSkip = useCallback(() => {
    advanceToNext()
  }, [advanceToNext])

  // Keyboard shortcuts
  useEffect(() => {
    if (mode !== "quick" || !currentTx) return

    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      const suggestions = currentTx.suggestedCategories ?? []
      if (e.key >= "1" && e.key <= "5") {
        const idx = parseInt(e.key) - 1
        if (suggestions[idx]) {
          setSelectedCategory(suggestions[idx].category)
          setSelectedSubcategory(suggestions[idx].subcategory)
        }
      } else if (e.key === "s" || e.key === "S") {
        handleSkip()
      } else if (e.key === "Enter" && selectedCategory) {
        handleConfirm()
      } else if (e.key === "Escape") {
        router.push("/finance/transactions")
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [mode, currentTx, selectedCategory, handleSkip, handleConfirm, router])

  const handleAITrigger = () => {
    aiCategorize.mutate(undefined, {
      onError: (err) => toast.error(err.message),
    })
  }

  const handleApplyAI = (accepted: Parameters<typeof applyAI.mutate>[0]["accepted"]) => {
    applyAI.mutate(
      { accepted },
      {
        onSuccess: (result) => {
          toast.success(`Applied ${result.applied} categorizations, ${result.rulesCreated} rules created`)
          aiCategorize.reset()
          refetch()
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const progressPercent = total > 0 ? (categorizedCount / (categorizedCount + total)) * 100 : 100

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Categorize Transactions</h1>
          <p className="text-sm text-foreground-muted mt-0.5">
            {total > 0 ? `${total} uncategorized` : "All done"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ModeButton active={mode === "quick"} icon="swipe" label="Quick Review" onClick={() => router.push("/finance/categorize")} />
          <ModeButton active={mode === "ai"} icon="auto_awesome" label="AI Categorize" onClick={() => router.push("/finance/categorize?mode=ai")} />
          <ModeButton active={mode === "audit"} icon="fact_check" label="AI Audit" onClick={() => router.push("/finance/categorize?mode=audit")} />
          <Link
            href="/finance/transactions"
            className="px-3 py-2 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Back
          </Link>
        </div>
      </div>

      {/* Progress bar */}
      {total > 0 && mode === "quick" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-foreground-muted">
            <span>{categorizedCount} categorized this session</span>
            <span>{total} remaining</span>
          </div>
          <div className="h-1.5 bg-background-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground transition-all duration-500"
              style={{ width: `${Math.max(progressPercent, 2)}%` }}
            />
          </div>
        </div>
      )}

      {/* Audit Mode */}
      {mode === "audit" && <CategorizeAuditMode onComplete={() => refetch()} />}

      {/* AI Mode */}
      {mode === "ai" && <AIMode total={total} aiCategorize={aiCategorize} applyAI={applyAI} onTrigger={handleAITrigger} onApply={handleApplyAI} router={router} />}

      {/* Quick Review Mode */}
      {mode === "quick" && (
        <>
          {isLoading && (
            <div className="bg-card border border-card-border rounded-2xl p-12 text-center animate-pulse">
              <div className="h-40 bg-background-secondary/50 rounded-xl" />
            </div>
          )}

          {!isLoading && transactions.length === 0 && (
            <EmptyState categorizedCount={categorizedCount} router={router} />
          )}

          {!isLoading && currentTx && (
            <div className="space-y-4">
              {/* 1. Transaction card */}
              <CategorizeCard
                merchantName={currentTx.merchantName}
                cleanedName={currentTx.cleanedName}
                name={currentTx.name}
                amount={currentTx.amount}
                date={currentTx.date}
                logoUrl={currentTx.logoUrl}
                accountName={currentTx.accountName}
                accountMask={currentTx.accountMask}
              />

              {/* 2. Nickname input */}
              <div className="relative">
                <span
                  className="material-symbols-rounded absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                  style={{ fontSize: 16 }}
                >
                  edit
                </span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Nickname (e.g. Health Insurance Premium)"
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-card border border-card-border text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
                />
              </div>

              {/* 3. Suggestion buttons */}
              <CategorySuggestions
                suggestions={currentTx.suggestedCategories}
                selected={selectedCategory}
                onSelect={(cat, sub) => {
                  setSelectedCategory(cat)
                  setSelectedSubcategory(sub)
                }}
              />

              {/* 4. Category grid (always visible, searchable, includes custom + "Add new") */}
              <CategoryPicker
                selected={selectedCategory}
                onSelect={(cat, sub) => {
                  setSelectedCategory(cat)
                  setSelectedSubcategory(sub)
                }}
              />

              {/* 5. Auto-apply checkbox + Skip/Confirm */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-foreground-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={createRule}
                    onChange={(e) => setCreateRule(e.target.checked)}
                    className="rounded border-card-border"
                  />
                  Auto-apply to future &ldquo;{currentTx.cleanedName}&rdquo; transactions
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-xs font-medium text-foreground-muted hover:text-foreground transition-colors"
                  >
                    Skip
                    <span className="ml-1 text-[10px] opacity-60">S</span>
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedCategory || updateCategory.isPending}
                    className="px-5 py-2.5 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    {updateCategory.isPending ? "..." : "Confirm"}
                    <span className="ml-1 text-xs opacity-60">&crarr;</span>
                  </button>
                </div>
              </div>

              {/* 6. Keyboard hint */}
              <p className="text-center text-[10px] text-foreground-muted/60">
                1-5 select suggestion &middot; S skip &middot; Enter confirm &middot; Esc exit
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ModeButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors",
        active
          ? "bg-foreground text-background"
          : "border border-card-border hover:bg-background-secondary"
      )}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  )
}

function EmptyState({ categorizedCount, router }: { categorizedCount: number; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="bg-card border border-card-border rounded-2xl py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-rounded text-success" style={{ fontSize: 24 }}>check_circle</span>
      </div>
      <h3 className="text-base font-semibold text-foreground mb-1.5">All caught up</h3>
      <p className="text-sm text-foreground-muted mb-4">
        {categorizedCount > 0
          ? `You categorized ${categorizedCount} transaction${categorizedCount > 1 ? "s" : ""} this session.`
          : "All transactions are categorized."}
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/finance/transactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
        >
          View transactions
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_forward</span>
        </Link>
        <button
          onClick={() => router.push("/finance/categorize?mode=audit")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover transition-colors"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>fact_check</span>
          Review with AI Audit
        </button>
      </div>
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function AIMode({ total, aiCategorize, applyAI, onTrigger, onApply, router }: {
  total: number
  aiCategorize: any
  applyAI: any
  onTrigger: () => void
  onApply: (accepted: any) => void
  router: ReturnType<typeof useRouter>
}) {
  return (
    <div className="space-y-4">
      {!aiCategorize.data && !aiCategorize.isPending && (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-background-secondary flex items-center justify-center mx-auto mb-4">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 24 }}>auto_awesome</span>
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1.5">AI Categorization</h3>
          <p className="text-sm text-foreground-muted max-w-md mx-auto mb-6">
            {total > 0
              ? `Send anonymized merchant names to your AI provider to categorize all ${total} transactions at once. Review suggestions before applying.`
              : "No uncategorized transactions. Try AI Audit to review existing categorizations."
            }
          </p>
          {total > 0 ? (
            <button onClick={onTrigger} className="px-6 py-3 bg-foreground text-background rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity">
              Categorize {total} Transactions
            </button>
          ) : (
            <button onClick={() => router.push("/finance/categorize?mode=audit")} className="px-6 py-3 border border-card-border rounded-xl text-sm font-semibold hover:bg-background-secondary transition-colors">
              Review with AI Audit
            </button>
          )}
        </div>
      )}

      {aiCategorize.isPending && (
        <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-foreground/20 border-t-foreground rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-foreground-muted">Analyzing transactions...</p>
        </div>
      )}

      {aiCategorize.data && aiCategorize.data.suggestions.length > 0 && (
        <AICategorizePreview
          suggestions={aiCategorize.data.suggestions}
          providerLabel={aiCategorize.data.providerLabel}
          onApply={onApply}
          isApplying={applyAI.isPending}
        />
      )}

      {aiCategorize.data && aiCategorize.data.suggestions.length === 0 && (
        <div className="bg-card border border-card-border rounded-2xl p-8 text-center">
          <p className="text-sm text-foreground-muted">No suggestions returned. Try the Quick Review mode instead.</p>
        </div>
      )}
    </div>
  )
}
