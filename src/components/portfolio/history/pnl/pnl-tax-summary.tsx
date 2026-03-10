"use client"

import { useMemo } from "react"
import { formatFiatValue } from "@/lib/portfolio/utils"
import { estimateTaxLiability } from "@/lib/portfolio/tax-export"

export function PnlTaxSummaryCard({
  data,
  costBasisMethod,
  taxYear,
}: {
  data: any
  costBasisMethod: string
  taxYear: string | null
}) {
  const { shortTermGain, longTermGain } = data.realized
  const estimate = useMemo(
    () => estimateTaxLiability(shortTermGain, longTermGain),
    [shortTermGain, longTermGain],
  )

  const year = taxYear ?? new Date().getUTCFullYear().toString()

  return (
    <div className="bg-card border border-card-border rounded-xl mb-4 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-foreground-muted text-[10px] font-semibold tracking-widest">
            {year} TAX SUMMARY
          </span>
        </div>
        <span className="text-foreground-muted text-xs font-data">
          {costBasisMethod} method
        </span>
      </div>

      {/* Totals */}
      <div className="px-5 py-4 border-b border-card-border">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-1">TOTAL PROCEEDS</p>
            <p className="text-foreground font-data text-base font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatFiatValue(data.realized.totalProceeds)}
            </p>
          </div>
          <div>
            <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-1">TOTAL COST BASIS</p>
            <p className="text-foreground font-data text-base font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatFiatValue(data.realized.totalCostBasis)}
            </p>
          </div>
          <div>
            <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-1">NET CAPITAL GAIN</p>
            <p
              className={`font-data text-base font-semibold ${data.realized.totalGain >= 0 ? "text-success" : "text-error"}`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {data.realized.totalGain >= 0 ? "+" : ""}{formatFiatValue(data.realized.totalGain)}
            </p>
          </div>
        </div>
        <p className="text-foreground-muted text-xs mt-2">{data.realized.count} disposals</p>
      </div>

      {/* Short-Term / Long-Term breakdown */}
      <div className="grid grid-cols-2 divide-x divide-card-border">
        <div className="p-5">
          <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-2">SHORT-TERM (&lt;1Y)</p>
          <p
            className={`font-data text-lg font-semibold ${shortTermGain >= 0 ? "text-success" : "text-error"}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {shortTermGain >= 0 ? "+" : ""}{formatFiatValue(shortTermGain)}
          </p>
          {estimate.marginalRates.shortTerm > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-foreground-muted text-xs">
                Taxed @ ~{(estimate.marginalRates.shortTerm * 100).toFixed(0)}%
              </p>
              <p className="text-foreground-muted text-xs font-data" style={{ fontVariantNumeric: "tabular-nums" }}>
                ~{formatFiatValue(estimate.shortTermTax)} est.
              </p>
            </div>
          )}
        </div>
        <div className="p-5">
          <p className="text-foreground-muted text-[10px] font-semibold tracking-widest mb-2">LONG-TERM (&ge;1Y)</p>
          <p
            className={`font-data text-lg font-semibold ${longTermGain >= 0 ? "text-success" : "text-error"}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {longTermGain >= 0 ? "+" : ""}{formatFiatValue(longTermGain)}
          </p>
          {estimate.marginalRates.longTerm > 0 && (
            <div className="mt-2 space-y-0.5">
              <p className="text-foreground-muted text-xs">
                Taxed @ ~{(estimate.marginalRates.longTerm * 100).toFixed(0)}%
              </p>
              <p className="text-foreground-muted text-xs font-data" style={{ fontVariantNumeric: "tabular-nums" }}>
                ~{formatFiatValue(estimate.longTermTax)} est.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Estimated total tax */}
      {(estimate.shortTermTax > 0 || estimate.longTermTax > 0) && (
        <div className="px-5 py-3 border-t border-card-border bg-background-secondary/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-foreground text-sm font-semibold">
                Estimated Total Tax: ~{formatFiatValue(estimate.totalEstimatedTax)}
              </p>
              {estimate.niit > 0 && (
                <p className="text-foreground-muted text-xs mt-0.5">
                  + NIIT (3.8%): ~{formatFiatValue(estimate.niit)}
                </p>
              )}
              {estimate.niit === 0 && (
                <p className="text-foreground-muted text-xs mt-0.5">
                  NIIT (3.8%): $0 (under $200k threshold)
                </p>
              )}
            </div>
            <p className="text-foreground-muted text-xs">
              Effective rate: {(estimate.effectiveRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
