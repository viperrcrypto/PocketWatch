"use client"

import { useCallback } from "react"
import { PortfolioAssetIcon } from "@/components/portfolio/portfolio-asset-icon"
import { formatCryptoAmount } from "@/lib/portfolio/utils"

type Transfer = {
  asset: string
  amount: number
  usd_value: number | null
  direction: string | null
  classification?: string | null
}

export function useSwapRowHelpers() {
  const getSwapRowKey = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (row: any, index: number) => {
      const hash = row.tx_hash ?? ""
      const dir = row.direction ?? ""
      const asset = row.asset ?? ""
      const id = row.id ?? ""
      return id ? `${id}` : hash ? `${hash}-${dir}-${asset}-${index}` : `row-${index}`
    },
    []
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderSwapExpandedRow = useCallback((row: any) => {
    const transfers: Transfer[] | undefined = row.grouped_transfers
    if (!transfers || transfers.length < 2) return null

    const isSwap = row.classification === "swap" || row.event_type === "swap"
    if (!isSwap) return null

    const fees = transfers.filter((t) => t.classification === "gas")

    // Dedup same-asset transfers per direction (intermediate DEX routing produces duplicates)
    function dedupByAsset(list: Transfer[]): Transfer[] {
      const seen = new Map<string, Transfer>()
      for (const t of list) {
        const existing = seen.get(t.asset)
        if (!existing || Math.abs(t.usd_value ?? 0) > Math.abs(existing.usd_value ?? 0)) {
          seen.set(t.asset, t)
        }
      }
      return [...seen.values()]
    }

    const sent = dedupByAsset(transfers.filter((t) => t.direction === "out" && t.classification !== "gas"))
    const received = dedupByAsset(transfers.filter((t) => t.direction === "in" && t.classification !== "gas"))

    if (sent.length === 0 || received.length === 0) return null

    // Calculate slippage if both sides have USD values
    const totalSentUsd = sent.reduce((sum, t) => sum + (t.usd_value ?? 0), 0)
    const totalReceivedUsd = received.reduce((sum, t) => sum + (t.usd_value ?? 0), 0)
    const hasUsdValues = totalSentUsd > 0 && totalReceivedUsd > 0
    const slippagePct = hasUsdValues ? ((totalReceivedUsd - totalSentUsd) / totalSentUsd) * 100 : null

    const totalFeeUsd = fees.reduce((sum, t) => sum + Math.abs(t.usd_value ?? 0), 0)
    const totalFeeAmount = fees.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    // Negative total = rebate (MEV, gas refund)
    const netFeeUsd = fees.reduce((sum, t) => sum + (t.usd_value ?? 0), 0)
    const isRebate = netFeeUsd < 0
    const feeAsset = fees.length > 0 ? fees[0].asset : null

    return (
      <div className="py-2 pl-10 flex items-center gap-2 text-xs font-data">
        {sent.map((t, i) => (
          <span key={`s${i}`} className="inline-flex items-center gap-1">
            <PortfolioAssetIcon asset={t.asset} size={16} showChainBadge={false} />
            <span className="text-foreground">{formatCryptoAmount(Math.abs(t.amount), 6)} {t.asset}</span>
            {t.usd_value != null && <span className="text-foreground-muted">${formatCryptoAmount(Math.abs(t.usd_value), 2)}</span>}
          </span>
        ))}
        <span className="text-foreground-muted mx-1">{"\u2192"}</span>
        {received.map((t, i) => (
          <span key={`r${i}`} className="inline-flex items-center gap-1">
            <PortfolioAssetIcon asset={t.asset} size={16} showChainBadge={false} />
            <span className="text-foreground">{formatCryptoAmount(Math.abs(t.amount), 6)} {t.asset}</span>
            {t.usd_value != null && <span className="text-foreground-muted">${formatCryptoAmount(Math.abs(t.usd_value), 2)}</span>}
          </span>
        ))}
        <span className="ml-auto flex items-center gap-4">
          {feeAsset && totalFeeAmount > 0 && (
            <span className={isRebate ? "text-success" : "text-foreground-muted"}>
              {isRebate ? "rebate" : "fee"} {formatCryptoAmount(totalFeeAmount, 6)} {feeAsset}
              {totalFeeUsd > 0 && <> (${formatCryptoAmount(totalFeeUsd, 2)})</>}
            </span>
          )}
          {slippagePct !== null && (
            <span className={slippagePct >= 0 ? "text-success" : "text-error"}>
              {slippagePct >= 0 ? "+" : ""}{slippagePct.toFixed(2)}% slippage
            </span>
          )}
        </span>
      </div>
    )
  }, [])

  return { getSwapRowKey, renderSwapExpandedRow }
}
