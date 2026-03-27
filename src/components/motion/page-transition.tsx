"use client"

import { motion, useReducedMotion } from "motion/react"
import { pageTransition, springs } from "@/lib/motion"

/**
 * Page entrance animation wrapper.
 * Used by `(dashboard)/template.tsx` to auto-animate every route.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      variants={pageTransition}
      initial="hidden"
      animate="visible"
      transition={reduce ? { duration: 0 } : springs.smooth}
    >
      {children}
    </motion.div>
  )
}
