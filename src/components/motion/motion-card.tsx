"use client"

import { motion, useReducedMotion } from "motion/react"
import { cardHover } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface MotionCardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  /** Disable hover lift animation */
  noHover?: boolean
  onClick?: () => void
}

/**
 * Card with spring-based hover lift and tap feedback.
 * Drop-in replacement for static cards that need interactivity.
 *
 * @example
 * <MotionCard className="bg-card rounded-xl p-5">
 *   <p>Hover me for a kinetic lift</p>
 * </MotionCard>
 */
export function MotionCard({
  children,
  className,
  style,
  noHover = false,
  onClick,
}: MotionCardProps) {
  const reduce = useReducedMotion()

  if (reduce || noHover) {
    return (
      <div className={cn(className)} style={style} onClick={onClick}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      className={cn(className)}
      style={style}
      onClick={onClick}
      {...cardHover}
    >
      {children}
    </motion.div>
  )
}
