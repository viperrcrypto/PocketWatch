"use client"

import { useEffect } from "react"
import { formatCurrency, cn } from "@/lib/utils"
import { useCancelGuidance, useUpdateSubscription } from "@/hooks/use-finance"

interface CancelTarget {
  id: string
  merchantName: string
  amount: number
  frequency: string
}

interface Props {
  target: CancelTarget | null
  onClose: () => void
}

const DIFFICULTY_STYLES: Record<string, { color: string; label: string }> = {
  easy: { color: "bg-success/10 text-success", label: "Easy" },
  medium: { color: "bg-warning/10 text-warning", label: "Medium" },
  hard: { color: "bg-error/10 text-error", label: "Hard" },
}

export function CancelGuidanceDrawer({ target, onClose }: Props) {
  const cancelGuide = useCancelGuidance()
  const updateSub = useUpdateSubscription()

  useEffect(() => {
    if (target) {
      cancelGuide.mutate({
        merchantName: target.merchantName,
        amount: target.amount,
        frequency: target.frequency,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.id])

  if (!target) return null

  const guidance = cancelGuide.data?.guidance
  const isLoading = cancelGuide.isPending
  const noProvider = cancelGuide.data?.available === false

  function handleMarkCancelled() {
    updateSub.mutate(
      { subscriptionId: target!.id, status: "cancelled" },
      { onSuccess: onClose },
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-card-border shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Cancel Subscription</h2>
            <p className="text-xs text-foreground-muted mt-0.5">
              {target.merchantName} &middot; {formatCurrency(target.amount)}/{target.frequency}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-foreground/5 transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-foreground-muted">Generating cancellation guide...</p>
            </div>
          )}

          {noProvider && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-5 text-center space-y-2">
              <span className="material-symbols-rounded text-warning" style={{ fontSize: 28 }}>key_off</span>
              <p className="text-sm font-medium text-foreground">No AI provider configured</p>
              <p className="text-xs text-foreground-muted">
                Set up an AI provider in Settings to get personalized cancellation guidance.
              </p>
              <a
                href="/settings"
                className="inline-block mt-2 px-4 py-2 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary-hover transition-colors"
              >
                Go to Settings
              </a>
            </div>
          )}

          {cancelGuide.isError && (
            <div className="bg-error/5 border border-error/20 rounded-xl p-5 text-center space-y-2">
              <span className="material-symbols-rounded text-error" style={{ fontSize: 28 }}>error</span>
              <p className="text-sm text-error">Failed to generate cancellation guide</p>
              <button
                onClick={() => cancelGuide.mutate({
                  merchantName: target.merchantName,
                  amount: target.amount,
                  frequency: target.frequency,
                })}
                className="text-xs text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {guidance && (
            <>
              {/* Metadata badges */}
              <div className="flex items-center gap-2">
                <span className={cn(
                  "px-2.5 py-1 text-[10px] font-medium rounded-full",
                  DIFFICULTY_STYLES[guidance.difficulty]?.color ?? "bg-foreground/5 text-foreground-muted",
                )}>
                  {DIFFICULTY_STYLES[guidance.difficulty]?.label ?? guidance.difficulty}
                </span>
                <span className="px-2.5 py-1 text-[10px] font-medium rounded-full bg-foreground/5 text-foreground-muted">
                  ~{guidance.estimatedTime}
                </span>
                {cancelGuide.data?.provider && (
                  <span className="ml-auto text-[10px] text-foreground-muted/50">
                    via {cancelGuide.data.provider}
                  </span>
                )}
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <p className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Steps</p>
                {guidance.steps.map((step) => (
                  <div key={step.step} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center mt-0.5">
                      {step.step}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-relaxed">{step.instruction}</p>
                      {step.url && (
                        <a
                          href={step.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>open_in_new</span>
                          {new URL(step.url).hostname}
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips */}
              {guidance.tips.length > 0 && (
                <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>lightbulb</span>
                    <p className="text-[10px] font-medium uppercase tracking-widest text-primary">Tips</p>
                  </div>
                  <ul className="space-y-1.5">
                    {guidance.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-foreground-muted leading-relaxed flex gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-card-border flex items-center gap-3">
          <button
            onClick={handleMarkCancelled}
            disabled={updateSub.isPending}
            className="flex-1 px-4 py-2.5 bg-error text-white text-sm font-medium rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
          >
            {updateSub.isPending ? "Updating..." : "Mark as Cancelled"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-foreground-muted hover:text-foreground rounded-lg border border-card-border hover:border-card-border-hover transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </>
  )
}
