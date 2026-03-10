"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/utils"

interface RecentTransaction {
  amount: number
  date: string
  name: string
}

interface SubscriptionCardTransactionsProps {
  transactions: RecentTransaction[]
}

export function SubscriptionCardTransactions({ transactions }: SubscriptionCardTransactionsProps) {
  const [showTxns, setShowTxns] = useState(false)

  if (transactions.length === 0) return null

  return (
    <div className="pt-1">
      <button
        onClick={() => setShowTxns(!showTxns)}
        className="flex items-center gap-1 text-[10px] text-foreground-muted hover:text-foreground transition-colors"
      >
        <span
          className="material-symbols-rounded transition-transform duration-200"
          style={{ fontSize: 14, transform: showTxns ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          expand_more
        </span>
        {showTxns ? "Hide" : "Show"} transactions ({transactions.length})
      </button>

      {showTxns && (
        <div className="mt-2 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {transactions.map((tx, i) => (
            <div key={i} className="flex items-center justify-between py-1 px-2 rounded-md bg-background-secondary/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-foreground-muted tabular-nums flex-shrink-0">
                  {new Date(tx.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className="text-[10px] text-foreground truncate">{tx.name}</span>
              </div>
              <span className="text-[10px] font-medium text-foreground tabular-nums flex-shrink-0 ml-2">
                {formatCurrency(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
