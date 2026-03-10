"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_STYLES: Record<string, string> = {
  active: "badge-success",
  paused: "badge-warning",
  cancelled: "badge-error",
  flagged: "badge-warning",
  dismissed: "badge-neutral",
}

interface SubscriptionCardActionsProps {
  id: string
  merchantName: string
  status: string
  isWanted: boolean
  amount: number
  frequency: string
  onUpdateStatus?: (id: string, status: string) => void
  onRequestCancel?: (sub: { id: string; merchantName: string; amount: number; frequency: string }) => void
  onToggleWanted?: (id: string, isWanted: boolean) => void
  onDismiss?: (id: string) => void
}

export function SubscriptionCardActions({
  id, merchantName, status, isWanted, amount, frequency,
  onUpdateStatus, onRequestCancel, onToggleWanted, onDismiss,
}: SubscriptionCardActionsProps) {
  const [showDismissConfirm, setShowDismissConfirm] = useState(false)
  const confirmRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showDismissConfirm) return
    function handleClickOutside(e: MouseEvent) {
      if (confirmRef.current && !confirmRef.current.contains(e.target as Node)) {
        setShowDismissConfirm(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [showDismissConfirm])

  function handleDismissConfirm() {
    setShowDismissConfirm(false)
    onDismiss?.(id)
    toast.success(`"${merchantName}" dismissed`)
  }

  return (
    <div className="flex items-center gap-2 pt-2 border-t border-card-border/50">
      {/* Status badge */}
      <span className={cn("badge text-xs", STATUS_STYLES[status] ?? "badge-neutral")}>
        {status}
      </span>

      {/* Cancel (active or paused) */}
      {(status === "active" || status === "paused") && (
        <button
          onClick={() => {
            if (onRequestCancel) {
              onRequestCancel({ id, merchantName, amount, frequency })
            } else {
              onUpdateStatus?.(id, "cancelled")
            }
          }}
          className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors"
        >
          Cancel
        </button>
      )}

      {/* Reactivate (cancelled only) */}
      {status === "cancelled" && (
        <button
          onClick={() => onUpdateStatus?.(id, "active")}
          className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
        >
          Reactivate
        </button>
      )}

      {/* Not a sub — dismiss with confirmation */}
      {status !== "cancelled" && status !== "dismissed" && (
        <div className="relative" ref={confirmRef}>
          <button
            onClick={() => setShowDismissConfirm(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-foreground-muted/60 hover:text-foreground-muted hover:bg-background-secondary rounded-lg transition-colors"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>block</span>
            Not a sub
          </button>

          {showDismissConfirm && (
            <div className="absolute top-full left-0 mt-1 z-30 bg-card border border-card-border rounded-lg shadow-lg p-3 min-w-[220px] animate-in fade-in zoom-in-95 duration-150">
              <p className="text-xs text-foreground mb-2">
                Dismiss <span className="font-semibold">{merchantName}</span> permanently?
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDismissConfirm}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-error hover:bg-error/90 rounded-lg transition-colors"
                >
                  Dismiss
                </button>
                <button
                  onClick={() => setShowDismissConfirm(false)}
                  className="px-3 py-1.5 text-xs font-medium text-foreground-muted hover:text-foreground hover:bg-background-secondary rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Keep / Drop toggle */}
      <button
        onClick={() => onToggleWanted?.(id, !isWanted)}
        className={cn(
          "ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
          isWanted
            ? "text-success/70 hover:text-success hover:bg-success/10"
            : "text-warning bg-warning/10 hover:bg-warning/20"
        )}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
          {isWanted ? "check_circle" : "thumb_down"}
        </span>
        {isWanted ? "Keeping" : "Drop"}
      </button>
    </div>
  )
}
