"use client"

import Link from "next/link"
import { TransactionRow } from "@/components/finance/transaction-row"

interface Transaction {
  id: string
  date: string
  merchantName: string | null
  name: string
  amount: number
  category: string | null
  subcategory?: string | null
  notes?: string | null
  isPending: boolean
  account?: { name?: string; mask?: string | null } | null
}

export function AccountTransactions({
  selectedAccount,
  txData,
  txLoading,
  txPage,
  onPageChange,
  onCategoryChange,
}: {
  selectedAccount: string
  txData: { transactions?: Transaction[]; pagination?: { total: number } } | undefined
  txLoading: boolean
  txPage: number
  onPageChange: (page: number) => void
  onCategoryChange: (txId: string, category: string, createRule?: boolean) => void
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>receipt_long</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Transactions</span>
          {txData?.pagination?.total != null && (
            <span className="text-[10px] text-foreground-muted">({txData.pagination.total} total)</span>
          )}
        </div>
        <Link href={`/finance/transactions?account=${selectedAccount}`} className="text-xs text-primary hover:text-primary/80 font-medium">
          View all
        </Link>
      </div>

      {txLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-shimmer rounded-lg" />
          ))}
        </div>
      ) : txData?.transactions?.length ? (
        <>
          <div className="divide-y divide-card-border/30">
            {txData.transactions.map((tx) => (
              <TransactionRow
                key={tx.id}
                id={tx.id}
                date={tx.date}
                merchantName={tx.merchantName}
                name={tx.name}
                amount={tx.amount}
                category={tx.category}
                subcategory={tx.subcategory}
                notes={tx.notes}
                isPending={tx.isPending}
                accountName={tx.account?.name ?? ""}
                accountMask={tx.account?.mask ?? null}
                onCategoryChange={(category, createRule) => onCategoryChange(tx.id, category, createRule)}
              />
            ))}
          </div>
          {(txData.pagination?.total ?? 0) > 20 && (
            <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-card-border/50">
              <button
                onClick={() => onPageChange(Math.max(1, txPage - 1))}
                disabled={txPage <= 1}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-card-border disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Previous
              </button>
              <span className="text-xs text-foreground-muted">
                Page {txPage} of {Math.ceil((txData.pagination?.total ?? 0) / 20)}
              </span>
              <button
                onClick={() => onPageChange(txPage + 1)}
                disabled={txPage >= Math.ceil((txData.pagination?.total ?? 0) / 20)}
                className="px-3 py-1 text-xs font-medium rounded-lg border border-card-border disabled:opacity-30 hover:bg-gray-50 dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-foreground-muted text-center py-8">No transactions found</p>
      )}
    </div>
  )
}
