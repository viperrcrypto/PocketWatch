"use client"

import { AnimatedOverlay } from "@/components/motion/animated-overlay"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "default" | "danger"
  isLoading?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  isLoading,
}: ConfirmDialogProps) {
  return (
    <AnimatedOverlay open={open} onClose={onClose} labelledBy="confirm-title" describedBy={description ? "confirm-desc" : undefined}>
      <h2
        id="confirm-title"
        className="text-lg font-semibold text-foreground mb-2"
      >
        {title}
      </h2>

      {description && (
        <p
          id="confirm-desc"
          className="text-sm text-foreground-muted mb-6 leading-relaxed"
        >
          {description}
        </p>
      )}

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-foreground-muted hover:text-foreground transition-colors rounded-lg"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isLoading}
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50",
            variant === "danger"
              ? "bg-error text-white hover:bg-error/90"
              : "bg-primary text-white hover:bg-primary/90"
          )}
        >
          {isLoading ? "..." : confirmLabel}
        </button>
      </div>
    </AnimatedOverlay>
  )
}
