"use client"

import { cn } from "@/lib/utils"

interface ConfidenceBarProps {
  confidence: number
  showLabel?: boolean
  className?: string
}

export function ConfidenceBar({ confidence, showLabel, className }: ConfidenceBarProps) {
  const pct = Math.round(confidence * 100)
  const color = confidence >= 0.8 ? "bg-success" : confidence >= 0.5 ? "bg-amber-500" : "bg-error"
  const label = confidence >= 0.8 ? "High" : confidence >= 0.5 ? "Medium" : "Low"

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 rounded-full bg-background-secondary overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-[10px] font-medium text-foreground-muted">{label}</span>
      )}
    </div>
  )
}
