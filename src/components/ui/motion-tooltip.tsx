"use client"

import { useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { easings } from "@/lib/motion"
import { motionDurations } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

type Side = "top" | "bottom" | "left" | "right"

interface MotionTooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: Side
  /** Delay before showing in ms (default 400). Exit is always instant. */
  delay?: number
  className?: string
}

const sidePos: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
}

const sideOffset: Record<Side, { x?: number; y?: number }> = {
  top: { y: 4 },
  bottom: { y: -4 },
  left: { x: 4 },
  right: { x: -4 },
}

/**
 * Hover tooltip with a deliberate appear delay and an instant exit — the
 * transitions.dev tooltip semantic (slow in, snap out so it never lingers).
 * Reduced-motion shows/hides with no fade or slide.
 *
 * @example <MotionTooltip content="Copy address"><button>…</button></MotionTooltip>
 */
export function MotionTooltip({
  content,
  children,
  side = "top",
  delay = 400,
  className,
}: MotionTooltipProps) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    timer.current = setTimeout(() => setOpen(true), delay)
  }
  const hide = () => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(false)
  }

  const off = sideOffset[side]

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            className={cn(
              "pointer-events-none absolute z-50 whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--foreground)] px-2 py-1 text-xs text-[var(--background)] shadow-md",
              sidePos[side],
              className
            )}
            initial={reduce ? { opacity: 1 } : { opacity: 0, ...off }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0 }}
            transition={
              reduce
                ? { duration: 0 }
                : { duration: motionDurations.fade, ease: easings.out }
            }
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}
