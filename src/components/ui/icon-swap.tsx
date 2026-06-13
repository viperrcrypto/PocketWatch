"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { easings } from "@/lib/motion"
import { motionDurations } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

interface IconSwapProps {
  /** Stable key identifying the current icon — swap animates on change. */
  swapKey: string | number
  children: React.ReactNode
  className?: string
  /** Blur radius at the crossfade extremes in px (default 4). */
  blur?: number
}

/**
 * Scale + blur crossfade between icons/glyphs (e.g. play↔pause, sun↔moon,
 * copy↔check). Old icon scales down + blurs out while the new one scales in.
 * Reduced-motion swaps instantly.
 *
 * @example
 * <IconSwap swapKey={copied ? "check" : "copy"}>
 *   <span className="material-symbols-rounded">{copied ? "check" : "content_copy"}</span>
 * </IconSwap>
 */
export function IconSwap({ swapKey, children, className, blur = 4 }: IconSwapProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <span className={cn("inline-grid", className)}>{children}</span>
  }

  return (
    <span className={cn("inline-grid [&>*]:[grid-area:1/1]", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={swapKey}
          initial={{ opacity: 0, scale: 0.6, filter: `blur(${blur}px)` }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.6, filter: `blur(${blur}px)` }}
          transition={{ duration: motionDurations.fade, ease: easings.out }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
