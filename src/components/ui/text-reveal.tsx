"use client"

import { motion, useReducedMotion } from "motion/react"
import { easings } from "@/lib/motion"
import { motionDurations } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

interface TextRevealProps {
  /** Lines to reveal, in order. Each rises + fades in sequence. */
  lines: readonly string[]
  className?: string
  /** Per-line className (e.g. heading vs body sizing). */
  lineClassName?: string
  /** Interval between lines in ms (default 60). */
  staggerMs?: number
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean
}

/**
 * Staggered line-rise reveal — each line clips + slides up into place.
 * Uses an overflow-hidden mask so lines emerge from behind their own baseline.
 * Reduced-motion renders all lines statically.
 *
 * @example <TextReveal lines={["Your net worth", "is growing"]} />
 */
export function TextReveal({
  lines,
  className,
  lineClassName,
  staggerMs = 60,
  inView = false,
}: TextRevealProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <div className={className}>
        {lines.map((line, i) => (
          <span key={i} className={cn("block", lineClassName)}>
            {line}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className={className}>
      {lines.map((line, i) => (
        <span key={i} className={cn("block overflow-hidden", lineClassName)}>
          <motion.span
            className="block"
            initial={{ y: "110%" }}
            {...(inView
              ? { whileInView: { y: 0 }, viewport: { once: true, margin: "-40px" } }
              : { animate: { y: 0 } })}
            transition={{
              duration: motionDurations.slide,
              ease: easings.out,
              delay: (i * staggerMs) / 1000,
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </div>
  )
}
