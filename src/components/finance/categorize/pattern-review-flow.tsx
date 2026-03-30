"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useQueryClient } from "@tanstack/react-query"
import { useReviewQueue, useConfirmReview } from "@/hooks/finance/use-review"
import { financeKeys } from "@/hooks/finance/shared"
import { PatternReviewCard } from "./pattern-review-card"
import { toast } from "sonner"

export function PatternReviewFlow() {
  const router = useRouter()
  const qc = useQueryClient()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewedCount, setReviewedCount] = useState(0)
  const [offset, setOffset] = useState(0)

  const { data, isLoading, refetch } = useReviewQueue(offset)
  const confirmReview = useConfirmReview()

  // Force fresh data on mount — prevents stale "All caught up" after AI rebuild
  useEffect(() => {
    refetch()
    qc.invalidateQueries({ queryKey: financeKeys.reviewCount() })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync the review count badge when queue is empty
  useEffect(() => {
    if (!isLoading && data && data.transactions.length === 0 && data.total === 0) {
      qc.invalidateQueries({ queryKey: financeKeys.reviewCount() })
    }
  }, [isLoading, data, qc])

  const transactions = data?.transactions ?? []
  const total = data?.total ?? 0
  const currentTx = transactions[currentIndex]

  const advance = useCallback(() => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      // React Query auto-refetches when offset in the query key changes
      setOffset((o) => o + 20)
      setCurrentIndex(0)
    }
  }, [currentIndex, transactions.length])

  const handleAccept = useCallback((nickname?: string) => {
    if (!currentTx) return
    confirmReview.mutate(
      { transactionId: currentTx.id, action: "accept", nickname },
      {
        onSuccess: () => {
          setReviewedCount((c) => c + 1)
          advance()
          if (nickname) toast.success(`Nicknamed "${currentTx.cleanedName}" → ${nickname}`)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }, [currentTx, confirmReview, advance])

  const handleChange = useCallback((category: string, subcategory?: string, nickname?: string) => {
    if (!currentTx) return
    confirmReview.mutate(
      { transactionId: currentTx.id, action: "change", category, subcategory, nickname },
      {
        onSuccess: () => {
          setReviewedCount((c) => c + 1)
          advance()
          toast.success(`Rule updated — future "${currentTx.cleanedName}" → ${category}${nickname ? ` (${nickname})` : ""}`)
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }, [currentTx, confirmReview, advance])

  const handleSkip = useCallback(() => {
    if (!currentTx) return
    confirmReview.mutate(
      { transactionId: currentTx.id, action: "skip" },
      { onSuccess: advance, onError: (err) => toast.error(err.message) }
    )
  }, [currentTx, confirmReview, advance])

  // Keyboard shortcuts
  useEffect(() => {
    if (!currentTx) return
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const suggestions = currentTx.suggestedCategories ?? []
      if (e.key >= "2" && e.key <= "5") {
        const idx = parseInt(e.key) - 1
        if (suggestions[idx]) handleChange(suggestions[idx].category, suggestions[idx].subcategory ?? undefined)
      } else if (e.key === "s" || e.key === "S") {
        handleSkip()
      } else if (e.key === "Enter") {
        handleAccept()
      } else if (e.key === "Escape") {
        router.push("/finance/transactions")
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [currentTx, handleAccept, handleChange, handleSkip, router])

  const progressPercent = total > 0 ? (reviewedCount / (reviewedCount + total)) * 100 : 100

  // Loading
  if (isLoading) {
    return <div className="rounded-2xl p-12 text-center"><div className="h-40 animate-shimmer rounded-xl" /></div>
  }

  // All reviewed
  if (transactions.length === 0) {
    return (
      <div className="bg-card border border-card-border rounded-2xl py-16 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-rounded text-success" style={{ fontSize: 24 }}>check_circle</span>
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1.5">All caught up</h3>
        <p className="text-sm text-foreground-muted mb-4">
          {reviewedCount > 0
            ? `You reviewed ${reviewedCount} transaction${reviewedCount > 1 ? "s" : ""} this session.`
            : "No transactions need review right now."}
        </p>
        <Link
          href="/finance/transactions"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
        >
          View transactions
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_forward</span>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-foreground-muted">
            <span>{reviewedCount} reviewed</span>
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

      {/* Card with enter animation */}
      {currentTx ? (
        <div key={currentTx.id} className="animate-fade-up">
          <PatternReviewCard
            transaction={currentTx}
            onAccept={handleAccept}
            onChange={handleChange}
            onSkip={handleSkip}
            isSubmitting={confirmReview.isPending}
          />
        </div>
      ) : total > 0 ? (
        <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
          <div className="h-8 w-8 mx-auto mb-3 border-2 border-foreground-muted/20 border-t-foreground rounded-full animate-spin" />
          <p className="text-sm text-foreground-muted">Loading next transaction...</p>
        </div>
      ) : null}

      {/* Keyboard hint */}
      <p className="text-center text-[10px] text-foreground-muted/60">
        Enter accept · 2-5 pick alternative · S skip · C change · Esc exit
      </p>
    </div>
  )
}
