"use client"

import { COST_BASIS_METHODS } from "./pnl-constants"

export function PnlMethodPicker({
  activeMethod,
  onMethodChange,
  isPending,
}: {
  activeMethod: string
  onMethodChange: (method: string) => void
  isPending: boolean
}) {
  return (
    <div className="flex items-center bg-card-border/30 rounded-lg p-0.5">
      {COST_BASIS_METHODS.map((m) => (
        <button
          key={m.value}
          onClick={() => onMethodChange(m.value)}
          disabled={isPending}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            activeMethod === m.value
              ? "bg-foreground text-background"
              : "text-foreground-muted hover:text-foreground"
          } ${isPending ? "opacity-50" : ""}`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
