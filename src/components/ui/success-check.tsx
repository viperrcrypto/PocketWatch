"use client"

import { motion, useReducedMotion } from "motion/react"
import { easings } from "@/lib/motion"
import { overshoot } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

interface SuccessCheckProps {
  /** Drives the animation — flips false→true to play (e.g. after a save). */
  show?: boolean
  /** Diameter in px (default 24). */
  size?: number
  /** Stroke/accent color. Default `var(--success)`. */
  color?: string
  className?: string
}

/**
 * Animated success checkmark — the badge pops in with a blur+rotate settle
 * while the tick path draws on. For confirmations (saved, synced, copied).
 * Reduced-motion renders the final checkmark statically.
 *
 * @example <SuccessCheck show={saved} />
 */
export function SuccessCheck({
  show = true,
  size = 24,
  color = "var(--success)",
  className,
}: SuccessCheckProps) {
  const reduce = useReducedMotion()
  if (!show) return null

  if (reduce) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden>
        <path
          d="M5 13l4 4 10-10"
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cn(className)}
      aria-hidden
      initial={{ scale: 0.5, rotate: -12, filter: "blur(4px)", opacity: 0 }}
      animate={{ scale: 1, rotate: 0, filter: "blur(0px)", opacity: 1 }}
      transition={overshoot()}
    >
      <motion.path
        d="M5 13l4 4 10-10"
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, ease: easings.out, delay: 0.08 }}
      />
    </motion.svg>
  )
}
