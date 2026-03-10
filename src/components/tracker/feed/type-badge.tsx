"use client"

import type { TransactionType } from "@/lib/tracker/types"

const TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: string }
> = {
  BUY: {
    label: "BUY",
    color: "var(--success)",
    bgColor: "var(--success-muted)",
    icon: "arrow_downward",
  },
  SELL: {
    label: "SELL",
    color: "var(--error)",
    bgColor: "var(--error-muted)",
    icon: "arrow_upward",
  },
  TRANSFER_IN: {
    label: "TRANSFER",
    color: "var(--info)",
    bgColor: "var(--info-muted)",
    icon: "call_received",
  },
  TRANSFER_OUT: {
    label: "TRANSFER",
    color: "var(--info)",
    bgColor: "var(--info-muted)",
    icon: "call_made",
  },
  SWAP: {
    label: "SWAP",
    color: "var(--warning)",
    bgColor: "var(--warning-muted)",
    icon: "swap_horiz",
  },
  APPROVE: {
    label: "APPROVE",
    color: "var(--foreground-muted)",
    bgColor: "var(--background-secondary)",
    icon: "check_circle",
  },
  BRIDGE: {
    label: "BRIDGE",
    color: "var(--purple-500, #c084fc)",
    bgColor: "color-mix(in srgb, var(--purple-500, #c084fc) 10%, transparent)",
    icon: "link",
  },
  UNKNOWN: {
    label: "UNKNOWN",
    color: "var(--foreground-muted)",
    bgColor: "var(--background-secondary)",
    icon: "help_outline",
  },
}

interface TypeBadgeProps {
  type: TransactionType
}

export default function TypeBadge({ type }: TypeBadgeProps) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.UNKNOWN

  return (
    <span
      className="badge inline-flex items-center gap-1"
      style={{
        borderColor: config.color,
        color: config.color,
        backgroundColor: config.bgColor,
      }}
    >
      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
        {config.icon}
      </span>
      {config.label}
    </span>
  )
}
