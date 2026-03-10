"use client"

import { useState } from "react"
import { useTaxHarvesting } from "@/hooks/use-portfolio-tracker"
import { formatFiatValue, shortenAddress } from "@/lib/portfolio/utils"

const TAX_RATE = 0.24

export function PnlHarvestingPanel() {
  const [expanded, setExpanded] = useState(false)
  const { data: harvesting } = useTaxHarvesting()

  if (!harvesting?.assets?.length) return null

  const losses = harvesting.assets.filter((a: any) => a.unrealizedGainUsd < 0)
  if (losses.length === 0) return null

  const totalLoss = harvesting.totalHarvestableLoss ?? 0
  const potentialSavings = Math.abs(totalLoss) * TAX_RATE

  return (
    <div className="bg-card border border-card-border rounded-xl mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-background-secondary transition-colors rounded-xl"
      >
        <div className="flex items-center gap-3">
          <span className="text-foreground-muted text-[10px] font-semibold tracking-widest">
            TAX-LOSS HARVESTING
          </span>
          <span className="inline-block px-2 py-0.5 rounded bg-success/10 text-success text-[10px] font-semibold">
            No wash sale restriction
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-error font-data text-sm font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatFiatValue(totalLoss)} harvestable
          </span>
          <span className="material-symbols-rounded text-foreground-muted text-sm">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-card-border">
          {/* Summary */}
          <div className="px-4 py-3 bg-background-secondary/30 border-b border-card-border">
            <div className="flex items-center justify-between">
              <p className="text-foreground-muted text-xs">
                Total harvestable losses: <span className="text-error font-data">{formatFiatValue(totalLoss)}</span>
              </p>
              <p className="text-foreground-muted text-xs">
                Potential tax savings (at {(TAX_RATE * 100).toFixed(0)}% est. rate): <span className="text-success font-data">~{formatFiatValue(potentialSavings)}</span>
              </p>
            </div>
            <p className="text-foreground-muted text-[10px] mt-1">
              Wash sale rule does not currently apply to cryptocurrency. You may immediately repurchase after harvesting losses.
            </p>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-card-border">
                  {["Symbol", "Wallet", "Cost Basis", "Current Value", "Unrealized", "Type"].map((h) => (
                    <th key={h} className="text-right px-4 py-3 text-foreground-muted first:text-left font-data text-[10px] font-medium tracking-wide uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {losses.map((a: any) => (
                  <tr key={`${a.walletAddress}-${a.asset}`} className="border-b border-card-border/50 hover:bg-background-secondary transition-colors">
                    <td className="px-4 py-3 text-foreground font-data text-xs font-medium">
                      {a.symbol}
                    </td>
                    <td className="text-right px-4 py-3 text-foreground-muted font-data text-xs">
                      {shortenAddress(a.walletAddress, 4)}
                    </td>
                    <td className="text-right px-4 py-3 text-foreground font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatFiatValue(a.costBasisUsd)}
                    </td>
                    <td className="text-right px-4 py-3 text-foreground font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatFiatValue(a.currentValueUsd)}
                    </td>
                    <td className="text-right px-4 py-3 text-error font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatFiatValue(a.unrealizedGainUsd)}
                    </td>
                    <td className="text-right px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${
                        a.isLongTerm ? "bg-info/10 text-info" : "bg-warning/10 text-warning"
                      }`}>
                        {a.isLongTerm ? "long" : "short"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
