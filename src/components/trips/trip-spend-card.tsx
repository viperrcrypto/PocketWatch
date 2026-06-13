"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/utils"
import { useUntagTripTransaction, type TripSpend, type TripTaggedTransaction } from "@/hooks/use-trips"

interface TripSpendCardProps {
  spend: TripSpend
  taggedTransactions: TripTaggedTransaction[]
  tripId: string
}

function formatTxDate(iso: string): string {
  // iso is yyyy-mm-dd — render without TZ drift.
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function TripSpendCard({ spend, taggedTransactions, tripId }: TripSpendCardProps) {
  const [expanded, setExpanded] = useState(false)
  const untag = useUntagTripTransaction()
  // Only the row currently being removed should show a spinner / be disabled —
  // not every row (the mutation is shared, so scope it by its in-flight id).
  const removingId = untag.isPending ? untag.variables?.transactionId : null

  const handleRemove = (tx: TripTaggedTransaction) => {
    untag.mutate(
      { transactionId: tx.id, tripId },
      {
        onSuccess: () => toast.success("Removed from this trip"),
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Failed to remove transaction"),
      },
    )
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Trip Spend</h3>
        <span
          className="material-symbols-rounded text-foreground-muted/40"
          style={{ fontSize: 18 }}
          aria-hidden="true"
        >
          payments
        </span>
      </div>

      <p className="text-2xl font-data font-black tabular-nums text-foreground" style={{ letterSpacing: "-0.02em" }}>
        {formatCurrency(spend.total, "USD", 2)}
      </p>
      <p className="text-xs text-foreground-muted mt-1">
        {spend.count} {spend.count === 1 ? "transaction" : "transactions"} during this trip
      </p>

      {spend.byCategory.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-card-border/40 pt-3">
          {spend.byCategory.slice(0, 5).map((c) => (
            <div key={c.category} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-foreground-muted truncate">{c.category}</span>
              <span className="font-data tabular-nums text-foreground flex-shrink-0">{formatCurrency(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      {taggedTransactions.length > 0 && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 w-full flex items-center justify-center gap-1 text-[11px] font-medium text-primary hover:underline"
            aria-expanded={expanded}
          >
            {expanded ? "Hide breakdown" : "See breakdown"}
            <span
              className="material-symbols-rounded transition-transform"
              style={{ fontSize: 14, transform: expanded ? "rotate(180deg)" : "none" }}
              aria-hidden="true"
            >
              expand_more
            </span>
          </button>

          {expanded && (
            <ul className="mt-2 space-y-1 border-t border-card-border/40 pt-2">
              {taggedTransactions.map((tx) => (
                <li key={tx.id} className="flex items-center gap-2 text-xs py-1 group">
                  {/* Clicking the row opens the transaction (deep-link highlight);
                      the × remove button is a sibling so it never navigates. */}
                  <Link
                    href={`/finance/transactions?highlight=${tx.id}`}
                    className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-foreground truncate">{tx.merchantName || tx.name}</p>
                      <p className="text-[10px] text-foreground-muted">
                        {formatTxDate(tx.date)}
                        {tx.category ? ` · ${tx.category}` : ""}
                      </p>
                    </div>
                    <span className="font-data tabular-nums text-foreground flex-shrink-0">
                      {formatCurrency(tx.amount)}
                    </span>
                  </Link>
                  <button
                    onClick={() => handleRemove(tx)}
                    disabled={removingId === tx.id}
                    className="flex-shrink-0 text-foreground-muted/50 hover:text-error transition-colors disabled:opacity-40"
                    aria-label={`Remove ${tx.merchantName || tx.name} from this trip`}
                    title="Remove from this trip"
                  >
                    <span
                      className={`material-symbols-rounded ${removingId === tx.id ? "animate-spin" : ""}`}
                      style={{ fontSize: 16 }}
                      aria-hidden="true"
                    >
                      {removingId === tx.id ? "progress_activity" : "close"}
                    </span>
                  </button>
                </li>
              ))}
              {spend.count > taggedTransactions.length && (
                <li className="text-[10px] text-foreground-muted/70 pt-1.5 text-center">
                  Showing the first {taggedTransactions.length} of {spend.count} transactions.
                </li>
              )}
            </ul>
          )}
        </>
      )}

      {spend.count === 0 && (
        <p className="text-[11px] text-foreground-muted/70 mt-3 leading-relaxed">
          No card spending found during these dates yet. Spending auto-tags when you
          open a past trip; you can also re-tag below.
        </p>
      )}
    </div>
  )
}
