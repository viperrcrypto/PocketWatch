"use client"

import { motion, useReducedMotion } from "motion/react"
import { staggerContainer, staggerItem } from "@/lib/motion"
import { cn } from "@/lib/utils"

interface StaggerChildrenProps {
  children: React.ReactNode
  className?: string
  /** Delay between each child in ms (default: 50) */
  staggerMs?: number
  /** Use "ul" or "ol" instead of "div" */
  as?: "div" | "ul" | "ol"
}

/**
 * Container that staggers its children's entrance animation.
 * Wrap each child in `<StaggerItem>` for the effect.
 *
 * @example
 * <StaggerChildren className="grid grid-cols-3 gap-4">
 *   <StaggerItem><Card /></StaggerItem>
 *   <StaggerItem><Card /></StaggerItem>
 * </StaggerChildren>
 */
export function StaggerChildren({
  children,
  className,
  staggerMs = 50,
  as = "div",
}: StaggerChildrenProps) {
  const reduce = useReducedMotion()
  const Tag = motion[as]

  return (
    <Tag
      className={cn(className)}
      variants={reduce ? undefined : staggerContainer(staggerMs)}
      initial={reduce ? undefined : "hidden"}
      animate={reduce ? undefined : "visible"}
    >
      {children}
    </Tag>
  )
}

interface StaggerItemProps {
  children: React.ReactNode
  className?: string
}

/** Individual stagger child — must be inside a `<StaggerChildren>` container. */
export function StaggerItem({ children, className }: StaggerItemProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      variants={staggerItem}
    >
      {children}
    </motion.div>
  )
}
