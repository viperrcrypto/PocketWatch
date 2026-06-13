"use client"

import { motion, useReducedMotion } from "motion/react"
import { pageTransition, durations, easings } from "@/lib/motion"

/**
 * Page entrance animation wrapper.
 * Used by `(dashboard)/template.tsx` to auto-animate every route.
 *
 * Subtle cross-route slide+fade (Picasso slide band: 0.35s, arrive easing).
 * Animates transform/opacity only; fully disabled under reduced-motion.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      transition={
        reduce
          ? { duration: 0 }
          : { duration: durations.slow, ease: easings.out }
      }
    >
      {children}
    </motion.div>
  )
}
