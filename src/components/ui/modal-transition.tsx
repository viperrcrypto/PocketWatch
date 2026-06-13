"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { durations, easings, scaleIn } from "@/lib/motion"
import { popSpring } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

interface ModalTransitionProps {
  open: boolean
  children: React.ReactNode
  /** Called when the backdrop is clicked. Omit to disable backdrop dismiss. */
  onBackdropClick?: () => void
  /** Render the dimmed/blurred backdrop (default true). */
  backdrop?: boolean
  backdropClassName?: string
  className?: string
}

/**
 * Scale-based modal enter/exit transition (transitions.dev modal semantic):
 * content springs up from 0.95 + fades, exits to 0.98 + fades; backdrop
 * crossfades. Presentational only — does NOT manage focus, Escape, scroll-lock
 * or portalling (use `AnimatedOverlay` if you need those). Reduced-motion makes
 * both backdrop and content instant.
 *
 * @example
 * <ModalTransition open={open} onBackdropClick={close}>
 *   <div className="card p-6">…</div>
 * </ModalTransition>
 */
export function ModalTransition({
  open,
  children,
  onBackdropClick,
  backdrop = true,
  backdropClassName,
  className,
}: ModalTransitionProps) {
  const reduce = useReducedMotion()

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {backdrop && (
            <motion.div
              className={cn(
                "absolute inset-0 bg-black/60 backdrop-blur-sm",
                backdropClassName
              )}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={
                reduce ? { duration: 0 } : { duration: durations.base, ease: easings.out }
              }
              onClick={onBackdropClick}
            />
          )}
          <motion.div
            className={cn("relative", className)}
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={reduce ? { duration: 0 } : popSpring}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
