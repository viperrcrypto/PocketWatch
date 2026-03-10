"use client"

import { useState } from "react"
import { formatFiatValue, shortenAddress } from "@/lib/portfolio/utils"

export function PnlOpenLotsPanel({ lots }: { lots: any }) {
  const [expanded, setExpanded] = useState(false)

  if (!lots?.lots?.length) return null

  return (
    <div className="bg-card border border-card-border rounded-xl">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-background-secondary transition-colors rounded-xl"
      >
        <span className="text-foreground-muted text-[10px] font-semibold tracking-widest">
          OPEN LOTS ({lots.totalLots} lots across {lots.totalAssets} assets)
        </span>
        <span className="material-symbols-rounded text-foreground-muted text-sm">
          {expanded ? "expand_less" : "expand_more"}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-card-border">
          {lots.lots.map((group: any) => (
            <div key={group.asset} className="border-b border-card-border/50 last:border-b-0">
              <div className="px-4 py-3 flex items-center justify-between bg-background-secondary/50">
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-data text-sm font-medium">{group.symbol}</span>
                  <span className="text-foreground-muted text-xs">{group.lotCount} lots</span>
                </div>
                <div className="text-right">
                  <span className="text-foreground font-data text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {group.totalQuantity.toFixed(6)}
                  </span>
                  <span className="text-foreground-muted text-xs ml-2">
                    avg {formatFiatValue(group.avgCostPerUnit)}/unit
                  </span>
                </div>
              </div>
              <table className="w-full">
                <tbody>
                  {group.lots.map((lot: any) => (
                    <tr key={lot.id} className="border-b border-card-border/30 last:border-b-0">
                      <td className="pl-8 pr-4 py-2 text-foreground-muted font-data text-xs">
                        {new Date(lot.acquiredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-2 text-foreground font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {lot.remainingQty.toFixed(6)} / {lot.quantity.toFixed(6)}
                      </td>
                      <td className="px-4 py-2 text-right text-foreground-muted font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatFiatValue(lot.costPerUnit)}/unit
                      </td>
                      <td className="px-4 py-2 text-right text-foreground-muted font-data text-xs">
                        {shortenAddress(lot.walletAddress, 4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
