"use client"

import { useMemo } from "react"
import { InvestmentTransactionRow } from "@/components/finance/investment-transaction-row"

interface InvestmentTx {
  id: string; type: string; name: string; date: string
  quantity: number | null; price: number | null; amount: number; fees: number | null
  security: { name: string | null; tickerSymbol: string | null } | null
}

interface MonthGroup { label: string; txs: InvestmentTx[] }

export function InvestmentsTransactionList({ transactions }: { transactions: InvestmentTx[] }) {
  const monthGroups = useMemo(() => {
    const groups = new Map<string, MonthGroup>()
    for (const tx of transactions) {
      const d = new Date(tx.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const existing = groups.get(key)
      if (existing) {
        groups.set(key, { ...existing, txs: [...existing.txs, tx] })
      } else {
        groups.set(key, { label: d.toLocaleDateString("en-US", { month: "long", year: "numeric" }), txs: [tx] })
      }
    }
    return groups
  }, [transactions])

  return (
    <div>
      {Array.from(monthGroups.keys()).sort().reverse().map((monthKey) => {
        const group = monthGroups.get(monthKey)!
        return (
          <div key={monthKey}>
            <div className="px-5 py-2 bg-background-secondary/40 border-b border-card-border/20 sticky top-0 z-10">
              <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">{group.label}</span>
            </div>
            <div className="divide-y divide-card-border/30">
              {group.txs.map((tx) => (
                <InvestmentTransactionRow key={tx.id} type={tx.type} name={tx.name} date={tx.date}
                  quantity={tx.quantity} price={tx.price} amount={tx.amount} fees={tx.fees} security={tx.security} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
