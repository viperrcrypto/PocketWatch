"use client"

import type { CSSProperties, ElementType } from "react"
import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

interface ShimmerTextProps {
  children: React.ReactNode
  className?: string
  /** Element to render as (default "span"). */
  as?: ElementType
  /** Base (dim) text color. Default `var(--foreground-secondary)`. */
  baseColor?: string
  /** Highlight (sweep) color. Default `var(--foreground)`. */
  highlightColor?: string
  /** One sweep duration in seconds (default 2.4). */
  duration?: number
}

/**
 * Text with a highlight band continuously sweeping across it — for "thinking…",
 * loading labels, or premium emphasis. Pure CSS (`.animate-shimmer-text`), so
 * the global prefers-reduced-motion rule already freezes it; we also drop the
 * animation class under `useReducedMotion`, leaving solid base-color text.
 *
 * @example <ShimmerText>Analyzing your portfolio…</ShimmerText>
 */
export function ShimmerText({
  children,
  className,
  as: Tag = "span",
  baseColor = "var(--foreground-secondary)",
  highlightColor = "var(--foreground)",
  duration = 2.4,
}: ShimmerTextProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return (
      <Tag className={className} style={{ color: baseColor }}>
        {children}
      </Tag>
    )
  }

  const style = {
    ["--shimmer-base" as string]: baseColor,
    ["--shimmer-highlight" as string]: highlightColor,
    ["--shimmer-duration" as string]: `${duration}s`,
  } as CSSProperties

  return (
    <Tag className={cn("animate-shimmer-text", className)} style={style}>
      {children}
    </Tag>
  )
}
