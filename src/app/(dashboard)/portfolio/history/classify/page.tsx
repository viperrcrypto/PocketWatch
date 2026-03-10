"use client"

import { useState, useMemo, useCallback } from "react"
import { toast } from "sonner"
import {
  useClassifyTransactions,
  useSetManualClassification,
} from "@/hooks/use-portfolio-tracker"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioSubNav } from "@/components/portfolio/portfolio-sub-nav"
import {
  PAGE_SIZE,
  formatClassificationLabel,
  StatsBar,
  QuickClassifyDropdown,
  type TransactionRow,
} from "@/components/portfolio/classify-helpers"
import { HISTORY_SUB_TABS } from "@/lib/portfolio/nav"
import { ClassifySkeletonTable } from "@/components/portfolio/history/classify/classify-skeleton-table"
import { ClassifyEmptyState } from "@/components/portfolio/history/classify/classify-empty-state"
import { ClassifyTransactionRow } from "@/components/portfolio/history/classify/classify-transaction-row"
import { ClassifyFilterBar } from "@/components/portfolio/history/classify/classify-filter-bar"
import { ClassifyBulkActions } from "@/components/portfolio/history/classify/classify-bulk-actions"
import { ClassifyPagination } from "@/components/portfolio/history/classify/classify-pagination"

// ─── Component ───

export default function ClassifyTransactionsPage() {
  // Filter state
  const [search, setSearch] = useState("")
  const [classificationFilter, setClassificationFilter] = useState("")
  const [directionFilter, setDirectionFilter] = useState("")
  const [chainFilter, setChainFilter] = useState("")
  const [unreviewedOnly, setUnreviewedOnly] = useState(false)

  // Pagination
  const [page, setPage] = useState(1)

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Quick-classify dropdown state
  const [classifyTarget, setClassifyTarget] = useState<{
    txId: string
    currentManual: string | null
    rect: DOMRect
  } | null>(null)

  // Query params
  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: search.trim() || undefined,
      classification: classificationFilter || undefined,
      direction: directionFilter || undefined,
      chain: chainFilter || undefined,
      unreviewedOnly: unreviewedOnly || undefined,
    }),
    [page, search, classificationFilter, directionFilter, chainFilter, unreviewedOnly]
  )

  const { data, isLoading, isFetching } = useClassifyTransactions(queryParams)
  const setManualClassification = useSetManualClassification()

  // Parse response
  const transactions: TransactionRow[] = useMemo(() => {
    if (!data) return []
    const items = data.transactions ?? data.items ?? data.entries ?? []
    if (!Array.isArray(items)) return []
    return items as TransactionRow[]
  }, [data])

  const totalCount = useMemo(() => {
    if (!data) return 0
    return data.total ?? data.totalCount ?? data.entries_found ?? transactions.length
  }, [data, transactions.length])

  const stats: Record<string, number> | undefined = useMemo(() => {
    if (!data?.stats) return undefined
    const raw = data.stats as {
      autoClassification?: Record<string, number>
      manualOverrides?: Record<string, number>
      totalManualOverrides?: number
    }
    // Flatten: merge auto classifications as base counts, add manual_overrides for the badge
    const flat: Record<string, number> = { ...raw.autoClassification }
    if (raw.totalManualOverrides && raw.totalManualOverrides > 0) {
      flat.manual_overrides = raw.totalManualOverrides
    }
    return Object.keys(flat).length > 0 ? flat : undefined
  }, [data])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const hasFilters = !!(search || classificationFilter || directionFilter || chainFilter || unreviewedOnly)

  // Selection helpers
  const allOnPageSelected = useMemo(
    () => transactions.length > 0 && transactions.every((tx) => selectedIds.has(tx.id)),
    [transactions, selectedIds]
  )

  const handleToggleAll = useCallback(() => {
    if (allOnPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const tx of transactions) next.delete(tx.id)
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (const tx of transactions) next.add(tx.id)
        return next
      })
    }
  }, [allOnPageSelected, transactions])

  const handleToggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Classify handlers
  const handleClassifySingle = useCallback(
    (txId: string, classification: string) => {
      setManualClassification.mutate(
        { transactionId: txId, classification },
        {
          onSuccess: () => toast.success(`Classification set to "${formatClassificationLabel(classification)}"`),
          onError: (err) => toast.error((err as Error).message ?? "Failed to set classification"),
        }
      )
    },
    [setManualClassification]
  )

  const handleClearSingle = useCallback(
    (txId: string) => {
      setManualClassification.mutate(
        { transactionId: txId, classification: null },
        {
          onSuccess: () => toast.success("Manual override cleared"),
          onError: (err) => toast.error((err as Error).message ?? "Failed to clear override"),
        }
      )
    },
    [setManualClassification]
  )

  const handleBulkClassify = useCallback(
    (classification: string) => {
      const ids = Array.from(selectedIds)
      if (ids.length === 0) return
      setManualClassification.mutate(
        { transactionIds: ids, classification },
        {
          onSuccess: () => {
            toast.success(`${ids.length} transaction${ids.length !== 1 ? "s" : ""} classified as "${formatClassificationLabel(classification)}"`)
            setSelectedIds(new Set())
          },
          onError: (err) => toast.error((err as Error).message ?? "Failed to classify transactions"),
        }
      )
    },
    [selectedIds, setManualClassification]
  )

  const handleBulkClear = useCallback(() => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setManualClassification.mutate(
      { transactionIds: ids, classification: null },
      {
        onSuccess: () => {
          toast.success(`Cleared overrides on ${ids.length} transaction${ids.length !== 1 ? "s" : ""}`)
          setSelectedIds(new Set())
        },
        onError: (err) => toast.error((err as Error).message ?? "Failed to clear overrides"),
      }
    )
  }, [selectedIds, setManualClassification])

  // Filter change handlers (reset page)
  const handleSearchChange = useCallback((value: string) => { setSearch(value); setPage(1) }, [])
  const handleClassificationFilterChange = useCallback((value: string) => { setClassificationFilter(value); setPage(1) }, [])
  const handleDirectionFilterChange = useCallback((value: string) => { setDirectionFilter(value); setPage(1) }, [])
  const handleChainFilterChange = useCallback((value: string) => { setChainFilter(value); setPage(1) }, [])
  const handleUnreviewedToggle = useCallback(() => { setUnreviewedOnly((v) => !v); setPage(1) }, [])

  const handleClearFilters = useCallback(() => {
    setSearch("")
    setClassificationFilter("")
    setDirectionFilter("")
    setChainFilter("")
    setUnreviewedOnly(false)
    setPage(1)
  }, [])

  return (
    <div className="space-y-0">
      <PortfolioSubNav tabs={HISTORY_SUB_TABS} />

      <PortfolioPageHeader
        title="Classify Transactions"
        subtitle="Review and manually classify transactions for accurate tax reporting"
      />

      <StatsBar stats={stats} />

      <ClassifyFilterBar
        search={search}
        classificationFilter={classificationFilter}
        directionFilter={directionFilter}
        chainFilter={chainFilter}
        unreviewedOnly={unreviewedOnly}
        hasFilters={hasFilters}
        onSearchChange={handleSearchChange}
        onClassificationChange={handleClassificationFilterChange}
        onDirectionChange={handleDirectionFilterChange}
        onChainChange={handleChainFilterChange}
        onUnreviewedToggle={handleUnreviewedToggle}
        onClearFilters={handleClearFilters}
      />

      <ClassifyBulkActions
        selectedCount={selectedIds.size}
        isPending={setManualClassification.isPending}
        onBulkClassify={handleBulkClassify}
        onBulkClear={handleBulkClear}
        onDeselectAll={() => setSelectedIds(new Set())}
      />

      {/* Data Table */}
      <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
        {isLoading ? (
          <ClassifySkeletonTable />
        ) : transactions.length === 0 ? (
          <ClassifyEmptyState hasFilters={hasFilters} />
        ) : (
          <div className="bg-card border border-card-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-card-border bg-card-elevated">
                    <th className="px-3 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={handleToggleAll}
                        className="w-4 h-4 rounded border-card-border-hover accent-primary cursor-pointer"
                        title={allOnPageSelected ? "Deselect all on page" : "Select all on page"}
                      />
                    </th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-left">Date</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-left hidden md:table-cell">Chain</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-left hidden lg:table-cell">Tx Hash</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-left hidden sm:table-cell">Dir</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-left">Asset</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-right hidden sm:table-cell">Amount</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-right hidden md:table-cell">Value</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-left hidden xl:table-cell">Auto</th>
                    <th className="px-4 py-3 text-xs font-medium text-foreground-muted whitespace-nowrap text-left">Manual</th>
                    <th className="px-3 py-3 w-12" />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <ClassifyTransactionRow
                      key={tx.id}
                      tx={tx}
                      isSelected={selectedIds.has(tx.id)}
                      onToggle={() => handleToggleOne(tx.id)}
                      onClassify={(rect) =>
                        setClassifyTarget({ txId: tx.id, currentManual: tx.manualClassification, rect })
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {transactions.length > 0 && (
        <ClassifyPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          onPageChange={setPage}
        />
      )}

      {classifyTarget && (
        <QuickClassifyDropdown
          anchorRect={classifyTarget.rect}
          currentManual={classifyTarget.currentManual}
          onSelect={(classification) => handleClassifySingle(classifyTarget.txId, classification)}
          onClear={() => handleClearSingle(classifyTarget.txId)}
          onClose={() => setClassifyTarget(null)}
        />
      )}
    </div>
  )
}
