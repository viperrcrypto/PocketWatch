"use client"

import { formatFiatValue } from "@/lib/portfolio/utils"

export function PnlGainsTable({ gains }: { gains: any }) {
  if (!gains?.entries?.length) return null

  return (
    <div className="bg-card border border-card-border rounded-xl mb-4">
      <div className="px-4 py-3 border-b border-card-border flex items-center justify-between">
        <span className="text-foreground-muted text-[10px] font-semibold tracking-widest">
          REALIZED GAINS
        </span>
        <span className="text-foreground-muted text-[10px]">
          {gains.total} transactions
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              {["Date Sold", "Acquired", "Asset", "Qty", "Proceeds", "Cost Basis", "Gain/Loss", "Holding", "Type", "Box"].map((h) => (
                <th key={h} className="text-right px-4 py-3 text-foreground-muted first:text-left font-data text-[10px] font-medium tracking-wide uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {gains.entries.map((g: any) => {
              const positive = g.gainUsd >= 0
              const acquiredDisplay = g.acquiredAtVarious
                ? "Various"
                : g.acquiredAt
                  ? new Date(g.acquiredAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : "-"
              return (
                <tr key={g.id} className="border-b border-card-border/50 hover:bg-background-secondary transition-colors">
                  <td className="px-4 py-3 text-foreground font-data text-xs">
                    {new Date(g.disposedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground-muted font-data text-xs">
                    {acquiredDisplay}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground font-data text-xs font-medium">
                    {g.symbol}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground-muted font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {g.quantity.toFixed(6)}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatFiatValue(g.proceedsUsd)}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground-muted font-data text-xs" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {formatFiatValue(g.costBasisUsd)}
                  </td>
                  <td className={`text-right px-4 py-3 font-data text-xs ${positive ? "text-success" : "text-error"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {positive ? "+" : ""}{formatFiatValue(g.gainUsd)}
                  </td>
                  <td className="text-right px-4 py-3 text-foreground-muted font-data text-xs">
                    {g.holdingPeriod}d
                  </td>
                  <td className="text-right px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded font-data text-[10px] font-semibold tracking-wide uppercase ${
                      g.isLongTerm ? "bg-info/10 text-info" : "bg-warning/10 text-warning"
                    }`}>
                      {g.isLongTerm ? "long" : "short"}
                    </span>
                  </td>
                  <td className="text-right px-4 py-3">
                    <span className="text-foreground-muted font-data text-[10px]">
                      {g.form8949Box}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
