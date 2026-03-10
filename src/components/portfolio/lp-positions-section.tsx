"use client"

import { useLPPositions } from "@/hooks/use-portfolio-tracker"

function formatUsd(value: number | null): string {
  if (value == null) return "--"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number | null): string {
  if (value == null) return "--"
  return `${value.toFixed(2)}%`
}

function Badge({
  children,
  variant = "default",
}: {
  children: React.ReactNode
  variant?: "default" | "success" | "warning"
}) {
  const colors = {
    default: "bg-foreground/10 text-foreground",
    success: "bg-emerald-500/15 text-emerald-400",
    warning: "bg-amber-500/15 text-amber-400",
  }
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${colors[variant]}`}
    >
      {children}
    </span>
  )
}

export function LPPositionsSection() {
  const { data: lpData, isLoading, error } = useLPPositions()

  const positions = lpData?.positions ?? []
  const inRangeCount = lpData?.inRangeCount ?? 0
  const outOfRangeCount = lpData?.outOfRangeCount ?? 0
  const totalValue = lpData?.totalValueUsd ?? 0

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">pool</span>
          Liquidity Pools
        </h2>
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl border border-card-border bg-card animate-pulse"
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">pool</span>
          Liquidity Pools
        </h2>
        <div className="bg-card border border-card-border rounded-xl p-6 text-center text-foreground-muted text-sm">
          Failed to load LP positions. Make sure your Alchemy API key is configured.
        </div>
      </div>
    )
  }

  if (positions.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <span className="material-symbols-rounded text-sm">pool</span>
          Liquidity Pools
        </h2>
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          <span>{positions.length} position{positions.length !== 1 ? "s" : ""}</span>
          <span className="text-foreground-muted/40">·</span>
          <span>{formatUsd(totalValue)}</span>
          {inRangeCount > 0 && <Badge variant="success">{inRangeCount} in range</Badge>}
          {outOfRangeCount > 0 && <Badge variant="warning">{outOfRangeCount} out</Badge>}
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-xl overflow-hidden divide-y divide-card-border">
        {positions.map((pos: any) => (
          <div
            key={`${pos.chain}-${pos.tokenId}`}
            className="p-4 hover:bg-primary-subtle transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {pos.token0.symbol ?? (pos.token0.address ? pos.token0.address.slice(0, 6) : "?")}/
                    {pos.token1.symbol ?? (pos.token1.address ? pos.token1.address.slice(0, 6) : "?")}
                  </span>
                  <span className="text-[10px] font-medium text-foreground-muted bg-foreground/5 px-1.5 py-0.5 rounded">
                    {pos.feeTier}
                  </span>
                  <Badge variant={pos.inRange ? "success" : "warning"}>
                    {pos.inRange ? "In Range" : "Out of Range"}
                  </Badge>
                </div>
                <div className="text-xs text-foreground-muted mt-0.5">
                  {pos.chain} · {pos.walletLabel ?? (pos.wallet ? pos.wallet.slice(0, 8) + "..." : "Unknown")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-data font-medium text-foreground tabular-nums">
                  {formatUsd(pos.totalValueUsd)}
                </div>
                {pos.ilPercent != null && (
                  <div
                    className={`text-[10px] font-data tabular-nums ${
                      pos.ilPercent < -1
                        ? "text-error"
                        : pos.ilPercent < 0
                          ? "text-warning"
                          : "text-foreground-muted"
                    }`}
                  >
                    IL: {formatPercent(pos.ilPercent)}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-2 text-xs">
              <div className="text-foreground-muted">
                {pos.token0.symbol ?? "Token0"}:{" "}
                <span className="text-foreground font-data">{pos.token0.amount?.toFixed(4)}</span>
                {pos.token0.valueUsd != null && (
                  <span className="ml-1">({formatUsd(pos.token0.valueUsd)})</span>
                )}
              </div>
              <div className="text-foreground-muted">
                {pos.token1.symbol ?? "Token1"}:{" "}
                <span className="text-foreground font-data">{pos.token1.amount?.toFixed(4)}</span>
                {pos.token1.valueUsd != null && (
                  <span className="ml-1">({formatUsd(pos.token1.valueUsd)})</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
