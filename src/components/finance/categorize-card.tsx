"use client"

import { formatCurrency, cn } from "@/lib/utils"
import { MerchantIcon } from "./merchant-icon"

// Note: MerchantIcon shows category-based icon or logo. For uncategorized txs
// we pass logoUrl (from Plaid) or fall back to the "Uncategorized" icon.

interface CategorizeCardProps {
  merchantName: string | null
  cleanedName: string
  name: string
  amount: number
  date: string
  logoUrl: string | null
  accountName: string | null
  accountMask: string | null
  nickname?: string | null
}

export function CategorizeCard({
  merchantName,
  cleanedName,
  name,
  amount,
  date,
  logoUrl,
  accountName,
  accountMask,
  nickname,
}: CategorizeCardProps) {
  const displayName = nickname || cleanedName || merchantName || name
  const formattedDate = new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="bg-card border border-card-border rounded-2xl p-6 md:p-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <MerchantIcon
          logoUrl={logoUrl}
          size="md"
        />

        <div>
          <h2 className="text-lg font-semibold text-foreground">{displayName}</h2>
          {displayName !== name && (
            <p className="text-xs text-foreground-muted mt-0.5 max-w-xs truncate">{name}</p>
          )}
        </div>

        <p className={cn(
          "text-2xl font-bold font-data tabular-nums",
          amount < 0 ? "text-success" : "text-foreground"
        )}>
          {amount < 0 ? "+" : ""}{formatCurrency(Math.abs(amount))}
        </p>

        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span>{formattedDate}</span>
          {accountName && (
            <>
              <span className="w-1 h-1 rounded-full bg-foreground-muted/40" />
              <span>{accountName}{accountMask ? ` ••${accountMask}` : ""}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
