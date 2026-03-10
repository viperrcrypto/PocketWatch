"use client"

import { formatFiatValue } from "@/lib/portfolio/utils"

export function PnlSummaryCards({ data }: { data: any }) {
  const cards = [
    {
      label: "REALIZED GAIN",
      value: data.realized.totalGain,
      isCurrency: true,
      showSign: true,
    },
    {
      label: "UNREALIZED COST BASIS",
      value: data.unrealized.totalCostBasis,
      isCurrency: true,
    },
    {
      label: "NET CAPITAL FLOWS",
      value: data.capitalFlows.net,
      isCurrency: true,
      showSign: true,
    },
    {
      label: "TOTAL RETURN %",
      value: data.capitalFlows.totalDeposits > 0
        ? ((data.realized.totalGain / data.capitalFlows.totalDeposits) * 100)
        : null,
      isPercent: true,
      showSign: true,
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
      {cards.map((card) => {
        const isNull = card.value == null
        const positive = !isNull && card.value >= 0
        return (
          <div key={card.label} className="bg-card border border-card-border p-4 rounded-xl">
            <p className="text-foreground-muted text-[10px] font-semibold tracking-widest">{card.label}</p>
            <p
              className={`mt-2 font-data ${isNull ? "text-foreground-muted" : card.showSign ? (positive ? "text-success" : "text-error") : "text-foreground"}`}
              style={{ fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}
            >
              {isNull
                ? "--"
                : <>
                    {card.showSign && positive ? "+" : ""}
                    {card.isPercent
                      ? `${card.value!.toFixed(2)}%`
                      : card.isCurrency
                        ? formatFiatValue(card.value!)
                        : card.value!.toLocaleString()}
                  </>
              }
            </p>
          </div>
        )
      })}
    </div>
  )
}
