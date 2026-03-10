"use client"

import { formatCurrency } from "@/lib/utils"

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  formatLabel?: (label: string) => string
}

export function ChartTooltip({ active, payload, label, formatLabel }: ChartTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-card border border-card-border rounded-lg px-3 py-2 shadow-lg text-xs">
      {label && (
        <p className="font-semibold text-foreground mb-1">
          {formatLabel ? formatLabel(label) : label}
        </p>
      )}
      {payload.map((entry) => (
        <div key={entry.name} className="flex justify-between gap-3">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-data text-foreground">
            {formatCurrency(Math.abs(entry.value))}
          </span>
        </div>
      ))}
    </div>
  )
}
