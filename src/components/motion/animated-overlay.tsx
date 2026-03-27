"use client"

import { useEffect, useRef, useCallback } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { fadeIn, scaleIn, springs, durations } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface AnimatedOverlayProps {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  /** Overlay darkness (default: "bg-black/60") */
  overlayClass?: string
  /** Content max width (default: "max-w-sm") */
  maxWidth?: string
  /** ID of the element that labels this dialog (for aria-labelledby) */
  labelledBy?: string
  /** ID of the element that describes this dialog (for aria-describedby) */
  describedBy?: string
}

/**
 * Modal overlay with spring open + fade close.
 * Replaces raw fixed-position modal patterns with proper exit animations.
 */
export function AnimatedOverlay({
  open,
  onClose,
  children,
  overlayClass = "bg-black/60",
  maxWidth = "max-w-sm",
  labelledBy,
  describedBy,
}: AnimatedOverlayProps) {
  const reduce = useReducedMotion()
  const contentRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    },
    [onClose],
  )

  // Escape key + focus + scroll lock
  useEffect(() => {
    if (!open) return
    document.addEventListener("keydown", handleKeyDown)
    contentRef.current?.focus()

    // Prevent background scrolling
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = prev
    }
  }, [open, handleKeyDown])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className={cn("absolute inset-0 backdrop-blur-sm", overlayClass)}
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={reduce ? { duration: 0 } : { duration: durations.base }}
            onClick={onClose}
          />

          {/* Content */}
          <motion.div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-describedby={describedBy}
            tabIndex={-1}
            className={cn(
              "relative bg-card border border-card-border rounded-xl p-6 w-full shadow-2xl",
              maxWidth,
            )}
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={
              reduce
                ? { duration: 0 }
                : springs.bouncy
            }
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
