"use client"

import { useState, useCallback } from "react"
import {
  useProcessHistory,
  useAddAddressBookEntry,
  useSetManualPrice,
  useFlagTransaction,
  useWhitelistTransaction,
} from "@/hooks/use-portfolio-tracker"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioSubNav } from "@/components/portfolio/portfolio-sub-nav"
import { PortfolioDataTable } from "@/components/portfolio/portfolio-data-table"
import { HISTORY_SUB_TABS } from "@/lib/portfolio/nav"

import { PAGE_SIZE, type SourceType, type AppliedFilters } from "@/components/portfolio/history/history-constants"
import { useHistoryData } from "@/components/portfolio/history/use-history-data"
import { HistoryHeaderActions } from "@/components/portfolio/history/history-header-actions"
import { HistoryFilterBar } from "@/components/portfolio/history/history-filter-bar"
import {
  SyncStatusBanner, SoftErrorBanner, HardErrorBanner,
  ProcessResultBanner, ProcessErrorBanner, ActiveFiltersIndicator,
} from "@/components/portfolio/history/history-status-banners"
import { useHistoryColumns } from "@/components/portfolio/history/history-columns"
import { useSwapRowHelpers } from "@/components/portfolio/history/history-swap-detail"
import { HistoryEmptyState } from "@/components/portfolio/history/history-empty-state"
import { HistoryPagination } from "@/components/portfolio/history/history-pagination"
import { QuickLabelPopover } from "@/components/portfolio/history/history-quick-label-popover"
import { QuickPricePopover } from "@/components/portfolio/history/history-quick-price-popover"

export default function HistoryEventsPage() {
  // ─── Filter state ───
  const [hideSpam, setHideSpam] = useState(true)
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false)
  const [eventType, setEventType] = useState("")
  const [sourceType, setSourceType] = useState<SourceType>("all")
  const [exchangeIdFilter, setExchangeIdFilter] = useState("all")
  const [walletFilter, setWalletFilter] = useState("all")
  const [asset, setAsset] = useState("")
  const [search, setSearch] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [appliedFilters, setAppliedFilters] = useState<AppliedFilters>({})

  // ─── Sorting & Pagination ───
  const [sortKey, setSortKey] = useState<string>("timestamp")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [offset, setOffset] = useState(0)

  const handleSort = useCallback((key: string) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(key === "timestamp" ? "desc" : "asc")
    }
    setOffset(0)
  }, [sortKey])

  // ─── Data ───
  const {
    data, isLoading, isFetching, isPlaceholderData, isError, error,
    events, displayEvents, spamCount, flaggedCount,
    totalFound, totalPages, currentPage,
    addressNames, ownAddresses, sentTokens, goplusScores,
    connectedExchangeOptions, walletOptions,
    syncData, syncIsRunning, syncProcessed, syncTotal, syncFailed,
  } = useHistoryData({ hideSpam, showFlaggedOnly, appliedFilters, offset, sortKey, sortDir })

  // ─── Mutations ───
  const processHistory = useProcessHistory()
  const addAddressEntry = useAddAddressBookEntry()
  const setManualPrice = useSetManualPrice()
  const flagTransaction = useFlagTransaction()
  const whitelistTransaction = useWhitelistTransaction()

  const processResult = processHistory.data as
    | { success?: boolean; status?: string; totalNewTransactions?: number; failedSyncs?: number; totalSyncs?: number }
    | undefined

  // ─── Popover state ───
  const [labelTarget, setLabelTarget] = useState<{ address: string; chain?: string; rect: DOMRect } | null>(null)
  const [priceTarget, setPriceTarget] = useState<{ symbol: string; chain: string; asset: string; rect: DOMRect } | null>(null)

  // ─── Expandable swap rows ───
  const [expandedSwapRows, setExpandedSwapRows] = useState<Set<string>>(new Set())
  const handleToggleSwapExpand = useCallback((key: string) => {
    setExpandedSwapRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // ─── Filter handlers ───
  const handleApplyFilters = useCallback(() => {
    const filters: AppliedFilters = {}
    if (eventType) filters.event_type = eventType
    filters.source = sourceType
    if (sourceType !== "onchain" && exchangeIdFilter !== "all") filters.exchangeId = exchangeIdFilter
    if (walletFilter !== "all") filters.wallet_address = walletFilter
    if (asset.trim()) filters.asset = asset.trim()
    if (search.trim()) filters.search = search.trim()
    if (fromDate) filters.from_timestamp = Math.floor(new Date(fromDate).getTime() / 1000)
    if (toDate) filters.to_timestamp = Math.floor(new Date(toDate + "T23:59:59").getTime() / 1000)
    setAppliedFilters(filters)
    setOffset(0)
  }, [eventType, sourceType, exchangeIdFilter, walletFilter, asset, search, fromDate, toDate])

  const handleClearFilters = useCallback(() => {
    setEventType(""); setSourceType("all"); setExchangeIdFilter("all"); setWalletFilter("all")
    setAsset(""); setSearch(""); setFromDate(""); setToDate("")
    setAppliedFilters({}); setOffset(0)
  }, [])

  const handlePrev = useCallback(() => { setOffset((prev) => Math.max(0, prev - PAGE_SIZE)) }, [])
  const handleNext = useCallback(() => {
    if (!isPlaceholderData && currentPage < totalPages) setOffset((prev) => prev + PAGE_SIZE)
  }, [isPlaceholderData, currentPage, totalPages])

  const hasActiveFilters =
    !!appliedFilters.event_type || (appliedFilters.source ? appliedFilters.source !== "all" : false) ||
    !!appliedFilters.exchangeId || !!appliedFilters.wallet_address || !!appliedFilters.asset ||
    !!appliedFilters.search || !!appliedFilters.from_timestamp || !!appliedFilters.to_timestamp

  // ─── Column definitions + swap helpers ───
  const columns = useHistoryColumns({
    addressNames, ownAddresses, sentTokens, goplusScores, hideSpam, expandedSwapRows,
    flagTransaction, whitelistTransaction, setLabelTarget, setPriceTarget,
  })
  const { getSwapRowKey, renderSwapExpandedRow } = useSwapRowHelpers()

  // ─── Render ───
  return (
    <div className="space-y-0">
      <PortfolioSubNav tabs={HISTORY_SUB_TABS} />

      <PortfolioPageHeader
        title="Activity"
        subtitle="Transaction events and portfolio timeline"
        actions={
          <HistoryHeaderActions
            showFlaggedOnly={showFlaggedOnly} setShowFlaggedOnly={setShowFlaggedOnly}
            flaggedCount={flaggedCount}
            hideSpam={hideSpam} setHideSpam={setHideSpam}
            spamCount={spamCount}
            isProcessPending={processHistory.isPending}
            onProcess={() => processHistory.mutate()}
            setOffset={setOffset}
          />
        }
      />

      <HistoryFilterBar
        search={search} setSearch={setSearch}
        eventType={eventType} setEventType={setEventType}
        sourceType={sourceType} setSourceType={setSourceType}
        exchangeIdFilter={exchangeIdFilter} setExchangeIdFilter={setExchangeIdFilter}
        walletFilter={walletFilter} setWalletFilter={setWalletFilter}
        fromDate={fromDate} setFromDate={setFromDate}
        toDate={toDate} setToDate={setToDate}
        asset={asset} setAsset={setAsset}
        isFetching={isFetching} hasActiveFilters={hasActiveFilters}
        connectedExchangeOptions={connectedExchangeOptions} walletOptions={walletOptions}
        onApplyFilters={handleApplyFilters} onClearFilters={handleClearFilters}
        setAppliedFilters={setAppliedFilters} setOffset={setOffset}
      />

      <SyncStatusBanner syncData={syncData} syncIsRunning={syncIsRunning} syncProcessed={syncProcessed} syncTotal={syncTotal} syncFailed={syncFailed} />
      {!isError && data?.error && <SoftErrorBanner data={data} />}
      {isError && !isLoading && events.length === 0 && <HardErrorBanner error={error as Error} />}
      {processHistory.isSuccess && processResult?.success !== false && (
        <ProcessResultBanner
          processStatus={processResult?.status}
          processFailedSyncs={processResult?.failedSyncs ?? 0}
          processTotalSyncs={processResult?.totalSyncs ?? 0}
          processNewTransactions={processResult?.totalNewTransactions ?? 0}
        />
      )}
      {processHistory.isError && <ProcessErrorBanner error={processHistory.error as Error} />}
      {hasActiveFilters && !isLoading && <ActiveFiltersIndicator appliedFilters={appliedFilters} />}

      <div className={isFetching && isPlaceholderData ? "opacity-60 transition-opacity" : ""}>
        {!isLoading && displayEvents.length === 0 && !isError ? (
          <HistoryEmptyState
            showFlaggedOnly={showFlaggedOnly} hasActiveFilters={hasActiveFilters}
            isProcessPending={processHistory.isPending}
            onShowAll={() => setShowFlaggedOnly(false)}
            onClearFilters={handleClearFilters}
            onProcessEvents={() => processHistory.mutate()}
          />
        ) : (
          <PortfolioDataTable
            columns={columns} data={displayEvents} isLoading={isLoading}
            emptyMessage="No history events found" emptyIcon="history"
            sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
            getRowKey={getSwapRowKey} renderExpandedRow={renderSwapExpandedRow}
            expandedKeys={expandedSwapRows} onToggleExpand={handleToggleSwapExpand}
          />
        )}
      </div>

      {displayEvents.length > 0 && (
        <HistoryPagination
          currentPage={currentPage} totalPages={totalPages} totalFound={totalFound}
          offset={offset} isPlaceholderData={isPlaceholderData} dataSource={data?.source}
          onPrev={handlePrev} onNext={handleNext}
        />
      )}

      {labelTarget && (
        <QuickLabelPopover
          address={labelTarget.address}
          currentName={addressNames.get(labelTarget.address.toLowerCase())}
          anchorRect={labelTarget.rect} isPending={addAddressEntry.isPending}
          onClose={() => setLabelTarget(null)}
          onSave={(name) => {
            addAddressEntry.mutate(
              { address: labelTarget.address, name, blockchain: labelTarget.chain ?? "ETH" },
              { onSuccess: () => setLabelTarget(null) }
            )
          }}
        />
      )}

      {priceTarget && (
        <QuickPricePopover
          symbol={priceTarget.symbol} chain={priceTarget.chain} asset={priceTarget.asset}
          anchorRect={priceTarget.rect} isPending={setManualPrice.isPending}
          onClose={() => setPriceTarget(null)}
          onSave={(priceUsd) => {
            setManualPrice.mutate(
              { chain: priceTarget.chain, asset: priceTarget.asset, symbol: priceTarget.symbol, priceUsd },
              { onSuccess: () => setPriceTarget(null) }
            )
          }}
        />
      )}
    </div>
  )
}
