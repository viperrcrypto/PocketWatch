"use client"

import { formatCurrency } from "@/lib/utils"
import Link from "next/link"

interface LinkedTransaction {
  id: string
  name: string
  merchantName: string | null
  amount: number
  date: string
  accountName: string | null
  accountMask: string | null
  institutionName: string | null
  category: string | null
}

interface Props {
  transaction: LinkedTransaction
}

export function SubscriptionLinkedProof({ transaction }: Props) {
  const dateStr = new Date(transaction.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  return (
    <div className="mx-4 mb-3 p-3 rounded-lg border border-success/20 bg-success/5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="material-symbols-rounded text-success text-sm">verified</span>
        <span className="text-[11px] font-semibold text-success uppercase tracking-wider">Last Payment Verified</span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{transaction.name}</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            {dateStr}
            {transaction.accountName && (
              <> &middot; {transaction.accountName}{transaction.accountMask ? ` ••${transaction.accountMask}` : ""}</>
            )}
            {transaction.category && (
              <> &middot; {transaction.category}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {formatCurrency(transaction.amount)}
          </span>
          <Link
            href={`/finance/transactions?highlight=${transaction.id}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-primary hover:bg-primary-muted transition-colors"
          >
            <span className="material-symbols-rounded text-xs">open_in_new</span>
            View
          </Link>
        </div>
      </div>
    </div>
  )
}
