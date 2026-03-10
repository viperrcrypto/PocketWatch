"use client"

import { useState, useCallback } from "react"
import { useTrackerFeed, useTrackerWallets } from "@/hooks/use-tracker"
import TransactionFeed from "@/components/tracker/feed/transaction-feed"
import FeedFilters, { type FeedFilterValues } from "@/components/tracker/feed/feed-filters"

export default function TrackerFeedPage() {
  const [filters, setFilters] = useState<FeedFilterValues>({})

  const { data: walletsData } = useTrackerWallets()
  const { data, isLoading } = useTrackerFeed({
    chain: filters.chain,
    type: filters.type,
    walletId: filters.walletId,
  })

  const wallets = walletsData?.wallets ?? []
  const transactions = data?.transactions ?? []

  const handleFilterChange = useCallback((newFilters: FeedFilterValues) => {
    setFilters(newFilters)
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Transaction Feed</h1>
          <p className="text-sm text-foreground-muted mt-0.5">
            Real-time activity across your tracked wallets
          </p>
        </div>
        {transactions.length > 0 && (
          <span className="text-xs text-foreground-muted font-mono tabular-nums">
            {transactions.length} transactions
          </span>
        )}
      </div>

      {/* Filters */}
      <FeedFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        wallets={wallets}
      />

      {/* Feed */}
      <TransactionFeed
        transactions={transactions}
        isLoading={isLoading}
        hasMore={!!data?.nextCursor}
      />
    </div>
  )
}
