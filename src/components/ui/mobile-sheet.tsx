"use client"

import { useEffect, useRef, useCallback, type ReactNode } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

interface MobileSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Show drag indicator bar at top (default: true) */
  dragIndicator?: boolean
  /** Additional class for the sheet panel */
  className?: string
}

/**
 * iOS-style bottom sheet for mobile viewports (< 768px).
 * On desktop (>= 768px), renders as a centered modal dialog.
 *
 * Features:
 * - Full-screen on mobile with overflow-y-auto
 * - Drag indicator + close button (44px touch targets)
 * - Backdrop tap to dismiss
 * - Escape key to dismiss
 * - Safe area inset handling
 * - Reduced motion support
 */
export function MobileSheet({
  open,
  onClose,
  title,
  children,
  dragIndicator = true,
  className,
}: MobileSheetProps) {
  const reduce = useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)

  // Escape key
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.body.style.overflow = prev }
  }, [open])

  const stopPropagation = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => e.stopPropagation(),
    [],
  )

  const transition = reduce ? { duration: 0 } : { type: "spring" as const, damping: 28, stiffness: 300 }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title || undefined}>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduce ? { duration: 0 } : { duration: 0.2 }}
            onClick={onClose}
          />

          {/* Mobile: full-screen sheet from bottom */}
          {/* Desktop: centered modal */}
          <motion.div
            className={cn(
              // Mobile: full-screen sheet
              "absolute inset-0 flex flex-col bg-card",
              // Desktop: centered modal with max-width
              "md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:w-full md:max-w-md md:max-h-[85dvh] md:rounded-2xl md:border md:border-card-border md:shadow-2xl",
              className,
            )}
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={transition}
            onClick={stopPropagation}
          >
            {/* Header with drag indicator + title + close */}
            <div className="flex-shrink-0 border-b border-card-border safe-area-top">
              {dragIndicator && (
                <div className="flex justify-center pt-2 md:hidden">
                  <div className="w-9 h-1 rounded-full bg-foreground-muted/30" />
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-3 min-h-[52px]">
                <h2 className="text-base font-semibold text-foreground truncate">
                  {title}
                </h2>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="touch-target rounded-xl text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors flex-shrink-0"
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 22 }}>close</span>
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div
              ref={contentRef}
              className="flex-1 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
