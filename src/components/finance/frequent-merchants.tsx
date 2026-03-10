"use client"

import { useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import { MerchantIcon } from "@/components/finance/merchant-icon"

interface FrequentMerchantsProps {
  merchants: Array<{
    name: string
    count: number
    total: number
    avgAmount?: number
    category?: string | null
    logoUrl?: string | null
  }>
}

/** Detect raw bank transaction descriptions that weren't normalized */
function isRawBankDescription(name: string): boolean {
  if (name.length > 45) return true
  const rawPatterns = /\b(DES:|ID:|INDN:|CRD |EPAY|XXXX|PAYMENT ID:|ONLINE DES:)/i
  if (rawPatterns.test(name)) return true
  // All-caps with numbers and special chars (e.g. "CITI CARD ONLINE DES:PAYMENT ID:XXXXXXXXXX87790")
  if (name === name.toUpperCase() && /\d{4,}/.test(name)) return true
  return false
}

export function FrequentMerchants({ merchants }: FrequentMerchantsProps) {
  const cleanMerchants = useMemo(
    () => merchants.filter((m) => !isRawBankDescription(m.name)),
    [merchants]
  )

  if (cleanMerchants.length === 0) {
    return <p className="text-sm text-foreground-muted text-center py-6">No merchant data yet</p>
  }

  return (
    <div className="divide-y divide-card-border/30">
      {cleanMerchants.map((m, i) => {
        const avg = m.avgAmount ?? (m.count > 0 ? m.total / m.count : 0)

        return (
          <div key={m.name} className="flex items-center gap-3 px-5 py-2.5">
            <span className="text-[10px] font-data text-foreground-muted tabular-nums w-4">{i + 1}</span>
            <MerchantIcon logoUrl={m.logoUrl} category={m.category} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
              <p className="text-[10px] text-foreground-muted">
                {m.count} transaction{m.count !== 1 ? "s" : ""} · avg {formatCurrency(avg)}
              </p>
            </div>
            <span className="font-data text-sm font-semibold text-foreground tabular-nums flex-shrink-0">
              {formatCurrency(m.total)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
