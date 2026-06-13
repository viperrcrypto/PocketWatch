"use client"

import type { ElementType } from "react"
import { Children } from "react"
import { motion, useReducedMotion, type Variants } from "motion/react"
import { springs } from "@/lib/motion"
import {
  STAGGER_CAP,
  STAGGER_INTERVAL_S,
  STAGGER_TRANSLATE_PX,
} from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"

interface StaggerRevealProps {
  children: React.ReactNode
  className?: string
  /** Interval between items in ms (Picasso band 40-80, default 60). */
  staggerMs?: number
  /** Translate distance in px (Picasso band 8-16, default 12). */
  distance?: number
  /** Items past this index reveal together as a group (default 8). */
  cap?: number
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean
  as?: "div" | "ul" | "ol" | "section"
}

/**
 * Staggered reveal container for lists / card grids / sections.
 * Each direct child is wrapped automatically — no need for a separate item.
 * Beyond `cap`, items share the final delay so long lists don't cascade forever.
 *
 * @example <StaggerReveal className="grid gap-4">{cards}</StaggerReveal>
 */
export function StaggerReveal({
  children,
  className,
  staggerMs = STAGGER_INTERVAL_S * 1000,
  distance = STAGGER_TRANSLATE_PX,
  cap = STAGGER_CAP,
  inView = false,
  as = "div",
}: StaggerRevealProps) {
  const reduce = useReducedMotion()
  const items = Children.toArray(children)
  const Tag = motion[as] as ElementType

  if (reduce) {
    const Plain = as as ElementType
    return <Plain className={className}>{children}</Plain>
  }

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: distance },
    visible: { opacity: 1, y: 0, transition: springs.gentle },
  }

  return (
    <Tag
      className={cn(className)}
      initial="hidden"
      {...(inView
        ? { whileInView: "visible", viewport: { once: true, margin: "-50px" } }
        : { animate: "visible" })}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerMs / 1000 } },
      }}
    >
      {items.map((child, i) => (
        <motion.div
          key={i}
          variants={itemVariants}
          custom={i}
          transition={{ delay: (Math.min(i, cap) * staggerMs) / 1000 }}
        >
          {child}
        </motion.div>
      ))}
    </Tag>
  )
}
