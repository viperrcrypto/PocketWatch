"use client"

import type { TrackerTransaction } from "@/lib/tracker/types"
import TransactionCard from "./transaction-card"

interface TransactionFeedProps {
  transactions: TrackerTransaction[]
  isLoading: boolean
  hasMore?: boolean
  onLoadMore?: () => void
}

function SkeletonCard() {
  return (
    <div className="card p-4 space-y-3 animate-pulse">
      {/* Top row skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-14 bg-card-border" />
          <div className="h-4 w-24 bg-card-border" />
          <div className="h-4 w-16 bg-card-border" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-4 w-12 bg-card-border" />
          <div className="h-4 w-14 bg-card-border" />
        </div>
      </div>
      {/* Middle row skeleton */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <div className="h-3 w-10 bg-card-border" />
          <div className="h-4 w-20 bg-card-border" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-12 bg-card-border" />
          <div className="h-4 w-24 bg-card-border" />
          <div className="h-3 w-16 bg-card-border" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-10 bg-card-border" />
          <div className="h-4 w-18 bg-card-border" />
        </div>
      </div>
      {/* Bottom row skeleton */}
      <div className="flex items-center gap-2 pt-1 border-t border-card-border">
        <div className="h-5 w-10 bg-card-border" />
        <div className="h-5 w-10 bg-card-border" />
        <div className="h-5 w-10 bg-card-border" />
        <div className="h-5 w-10 bg-card-border" />
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="card p-12 flex flex-col items-center justify-center text-center space-y-3">
      <span
        className="material-symbols-rounded text-card-border"
        style={{ fontSize: 48 }}
      >
        rss_feed
      </span>
      <h3 className="text-lg text-foreground">No transactions yet</h3>
      <p className="text-sm text-foreground-muted max-w-sm">
        Add wallets to start tracking. Transactions will appear here in real-time
        as your tracked wallets make trades.
      </p>
    </div>
  )
}

export default function TransactionFeed({
  transactions,
  isLoading,
  hasMore,
  onLoadMore,
}: TransactionFeedProps) {
  if (isLoading && transactions.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  if (!isLoading && transactions.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-2">
      {transactions.map((tx) => (
        <TransactionCard key={tx.id} tx={tx} />
      ))}

      {isLoading && (
        <div className="space-y-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {hasMore && !isLoading && onLoadMore && (
        <button
          onClick={onLoadMore}
          className="btn-secondary w-full mt-2"
        >
          <span className="material-symbols-rounded mr-2" style={{ fontSize: 16 }}>
            expand_more
          </span>
          Load More
        </button>
      )}
    </div>
  )
}
