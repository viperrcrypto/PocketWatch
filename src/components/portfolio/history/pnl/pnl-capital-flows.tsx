"use client"

import { formatFiatValue } from "@/lib/portfolio/utils"

export function PnlCapitalFlowsSummary({ data }: { data: any }) {
  const { totalDeposits, totalWithdrawals, net, depositCount, withdrawalCount } = data.capitalFlows

  return (
    <div className="bg-card border border-card-border rounded-xl mb-4">
      <div className="px-4 py-3 border-b border-card-border">
        <span className="text-foreground-muted text-[10px] font-semibold tracking-widest">
          CAPITAL FLOWS
        </span>
      </div>
      <div className="grid grid-cols-3 divide-x divide-card-border">
        <div className="p-4 text-center">
          <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-1">DEPOSITS</p>
          <p className="text-success font-data text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            +{formatFiatValue(totalDeposits)}
          </p>
          <p className="text-foreground-muted text-xs">{depositCount} txns</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-1">WITHDRAWALS</p>
          <p className="text-error font-data text-lg font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
            -{formatFiatValue(totalWithdrawals)}
          </p>
          <p className="text-foreground-muted text-xs">{withdrawalCount} txns</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-1">NET</p>
          <p className={`font-data text-lg font-semibold ${net >= 0 ? "text-success" : "text-error"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
            {net >= 0 ? "+" : ""}{formatFiatValue(net)}
          </p>
        </div>
      </div>
    </div>
  )
}
