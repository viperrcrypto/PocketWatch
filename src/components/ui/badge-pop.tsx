"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { popSpring } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

interface BadgePopProps {
  /** Badge content — usually a count. Hidden when 0/empty unless `showZero`. */
  count?: number
  /** Render arbitrary content instead of a count (e.g. a dot). */
  children?: React.ReactNode
  /** Show even when count is 0 (default false). */
  showZero?: boolean
  /** Cap the displayed number, e.g. 9 → "9+" (default 99). */
  max?: number
  className?: string
}

/**
 * Notification badge that pops in with a spring and pops out when cleared.
 * Re-pops whenever the count changes (keyed on value). Reduced-motion shows /
 * hides instantly with no scale animation.
 *
 * @example <BadgePop count={unread} className="absolute -top-1 -right-1" />
 */
export function BadgePop({
  count,
  children,
  showZero = false,
  max = 99,
  className,
}: BadgePopProps) {
  const reduce = useReducedMotion()
  const hasCount = typeof count === "number"
  const visible = children != null || (hasCount && (count! > 0 || showZero))

  const label =
    children ?? (hasCount ? (count! > max ? `${max}+` : count) : null)

  const base = cn(
    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold leading-none tabular-nums",
    "bg-[var(--primary)] text-white",
    className
  )

  if (reduce) {
    return visible ? <span className={base}>{label}</span> : null
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.span
          key={typeof label === "string" || typeof label === "number" ? label : "badge"}
          className={base}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={popSpring}
        >
          {label}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
