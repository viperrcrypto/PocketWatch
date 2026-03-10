"use client"

import { getChainMeta } from "@/lib/portfolio/chains"
import { ChainIcon } from "@/components/portfolio/chain-icon"

interface ChainBadgeProps {
  chainId: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZE_CONFIG = {
  sm: { icon: 18, fontSize: 10, padding: "px-2 py-1", gap: "gap-1.5" },
  md: { icon: 22, fontSize: 11, padding: "px-2.5 py-1", gap: "gap-2" },
  lg: { icon: 26, fontSize: 13, padding: "px-3 py-1.5", gap: "gap-2.5" },
} as const

export function ChainBadge({ chainId, size = "md", className }: ChainBadgeProps) {
  const meta = getChainMeta(chainId)
  const cfg = SIZE_CONFIG[size]
  const displayName = size === "sm" ? (meta?.symbol ?? chainId.slice(0, 4).toUpperCase()) : (meta?.name ?? chainId)

  return (
    <span
      className={`inline-flex items-center ${cfg.gap} border border-card-border ${cfg.padding} font-data text-foreground-muted uppercase ${className ?? ""}`}
      style={{
        fontSize: cfg.fontSize,
        fontWeight: 500,
      }}
    >
      <ChainIcon chainId={chainId} size={cfg.icon} />
      {displayName}
    </span>
  )
}
