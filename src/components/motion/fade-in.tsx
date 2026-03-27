"use client"

import { motion, useReducedMotion } from "motion/react"
import { springs } from "@/lib/motion"
import { cn } from "@/lib/utils"

type Direction = "up" | "down" | "left" | "right" | "none"

interface FadeInProps {
  children: React.ReactNode
  className?: string
  /** Direction the element fades in from (default: "up") */
  direction?: Direction
  /** Delay in seconds (default: 0) */
  delay?: number
  /** Animation distance in px (default: 12) */
  distance?: number
  /** Only animate when scrolled into view */
  inView?: boolean
  /** Viewport margin for inView trigger (default: "-50px") */
  viewMargin?: string
}

const directionMap: Record<Direction, { x?: number; y?: number }> = {
  up: { y: 1 },
  down: { y: -1 },
  left: { x: 1 },
  right: { x: -1 },
  none: {},
}

/**
 * Configurable fade-in entrance animation.
 *
 * @example
 * <FadeIn direction="up" delay={0.1}>
 *   <Card>...</Card>
 * </FadeIn>
 *
 * <FadeIn inView direction="up">
 *   <Section /> // animates when scrolled into view
 * </FadeIn>
 */
export function FadeIn({
  children,
  className,
  direction = "up",
  delay = 0,
  distance = 12,
  inView = false,
  viewMargin = "-50px",
}: FadeInProps) {
  const reduce = useReducedMotion()
  const dir = directionMap[direction]

  const initial = reduce
    ? undefined
    : {
        opacity: 0,
        ...(dir.x != null ? { x: dir.x * distance } : {}),
        ...(dir.y != null ? { y: dir.y * distance } : {}),
      }

  const animate = reduce
    ? undefined
    : { opacity: 1, x: 0, y: 0 }

  const viewportProps = inView
    ? { whileInView: animate, viewport: { once: true, margin: viewMargin } }
    : { animate }

  return (
    <motion.div
      className={cn(className)}
      initial={initial}
      {...viewportProps}
      transition={reduce ? { duration: 0 } : { ...springs.gentle, delay }}
    >
      {children}
    </motion.div>
  )
}
