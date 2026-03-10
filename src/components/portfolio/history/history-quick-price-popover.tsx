"use client"

import { useState, useRef, useEffect } from "react"
import { formatCryptoAmount } from "@/lib/portfolio/utils"

export function QuickPricePopover({
  symbol,
  chain,
  asset,
  anchorRect,
  onSave,
  onClose,
  isPending,
}: {
  symbol: string
  chain: string
  asset: string
  anchorRect: DOMRect
  onSave: (priceUsd: number) => void
  onClose: () => void
  isPending: boolean
}) {
  const [price, setPrice] = useState("")
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const top = anchorRect.bottom + 4
  const left = Math.max(8, anchorRect.left - 80)
  const parsed = parseFloat(price)
  const valid = !isNaN(parsed) && parsed >= 0

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-card border border-card-border rounded-xl shadow-lg p-3 w-72"
      style={{ top, left }}
    >
      <p className="text-[10px] font-medium tracking-wider text-foreground-muted mb-1">
        Set price for {symbol}
      </p>
      <p className="text-[10px] text-foreground-muted/60 font-data mb-2 truncate">
        {chain} · {asset === "native" ? "Native token" : asset}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave(parsed)
        }}
        className="flex gap-2"
      >
        <div className="flex-1 flex items-center gap-1 bg-background border border-card-border-hover focus-within:border-foreground rounded-lg px-2">
          <span className="text-foreground-muted text-xs">$</span>
          <input
            autoFocus
            type="number"
            step="any"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="0.00"
            className="flex-1 bg-transparent outline-none py-1.5 text-foreground text-xs font-data"
          />
        </div>
        <button
          type="submit"
          disabled={!valid || isPending}
          className="btn-primary px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
        >
          {isPending ? "..." : "Save"}
        </button>
      </form>
      <p className="text-[9px] text-foreground-muted/50 mt-1.5">
        Applies to all {symbol} transactions on {chain}
      </p>
    </div>
  )
}
