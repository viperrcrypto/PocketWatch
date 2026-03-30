"use client"

import { HybridTooltip } from "./hybrid-tooltip"

interface InfoTooltipProps {
  content: string
  children?: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
}

/**
 * Info tooltip that works on both desktop (hover) and mobile (tap-to-toggle).
 * Wraps HybridTooltip for backward compatibility.
 */
export function InfoTooltip({ content, children, side = "top" }: InfoTooltipProps) {
  return (
    <HybridTooltip content={content} side={side}>
      {children}
    </HybridTooltip>
  )
}
