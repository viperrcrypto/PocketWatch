"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { csrfHeaders } from "@/lib/csrf-client"
import {
  useHistoryEvents,
  useAddressBook,
  useTrackedAccounts,
  useSyncProgress,
  useExternalServices,
} from "@/hooks/use-portfolio-tracker"
import { shortenAddress } from "@/lib/portfolio/utils"
import { PAGE_SIZE, SPAM_BATCH, type AppliedFilters } from "./history-constants"
import { getSpamScore, isSpam } from "./history-spam"

/**
 * Encapsulates all data-fetching, parsing, spam filtering, and derived lookups
 * for the history events page.
 */
export function useHistoryData({
  hideSpam,
  showFlaggedOnly,
  appliedFilters,
  offset,
  sortKey,
  sortDir,
}: {
  hideSpam: boolean
  showFlaggedOnly: boolean
  appliedFilters: AppliedFilters
  offset: number
  sortKey: string
  sortDir: "asc" | "desc"
}) {
  // ─── Data queries ───
  const queryParams = useMemo(
    () => ({ offset: hideSpam ? 0 : offset, limit: hideSpam ? SPAM_BATCH : PAGE_SIZE, ...appliedFilters }),
    [offset, appliedFilters, hideSpam]
  )

  const { data, isLoading, isFetching, isPlaceholderData, isError, error } = useHistoryEvents(queryParams)
  const { data: syncData } = useSyncProgress()
  const { data: externalServicesData } = useExternalServices()
  const { data: addressBookData } = useAddressBook()
  const { data: trackedAccountsData } = useTrackedAccounts()

  // ─── Connected exchanges ───
  const connectedExchangeOptions = useMemo(() => {
    const rows = (externalServicesData as { services?: Array<{ isExchange?: boolean; exchangeId?: string; exchangeLabel?: string }> } | undefined)?.services ?? []
    const seen = new Set<string>()
    return rows
      .filter((s) => s.isExchange && s.exchangeId && !seen.has(s.exchangeId))
      .map((s) => { seen.add(s.exchangeId!); return { id: s.exchangeId!, label: s.exchangeLabel ?? s.exchangeId! } })
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [externalServicesData])

  // ─── Address name resolution ───
  const addressNames = useMemo(() => {
    const map = new Map<string, string>()
    if (trackedAccountsData && typeof trackedAccountsData === "object") {
      for (const chainAccounts of Object.values(trackedAccountsData)) {
        if (!Array.isArray(chainAccounts)) continue
        for (const acct of chainAccounts) {
          const addr = (acct.address ?? "").toLowerCase()
          const label = acct.label ?? acct.name
          if (addr && label) map.set(addr, label)
        }
      }
    }
    if (addressBookData) {
      const entries = Array.isArray(addressBookData) ? addressBookData : (addressBookData.addresses ?? addressBookData.entries ?? [])
      for (const entry of entries) {
        const addr = (entry.address ?? "").toLowerCase()
        const name = entry.name ?? entry.label
        if (addr && name) map.set(addr, name)
      }
    }
    return map
  }, [addressBookData, trackedAccountsData])

  const walletOptions = useMemo(() => {
    const progress = (syncData as { progress?: Array<{ walletAddress: string }> })?.progress ?? []
    const seen = new Set<string>()
    const options: Array<{ address: string; label: string }> = []
    for (const row of progress) {
      const addr = row.walletAddress
      if (!addr || seen.has(addr.toLowerCase())) continue
      seen.add(addr.toLowerCase())
      const nickname = addressNames.get(addr.toLowerCase())
      options.push({ address: addr, label: nickname ? `${nickname} (${shortenAddress(addr)})` : shortenAddress(addr) })
    }
    return options
  }, [syncData, addressNames])

  const ownAddresses = useMemo(() => {
    const set = new Set<string>()
    if (trackedAccountsData && typeof trackedAccountsData === "object") {
      for (const chainAccounts of Object.values(trackedAccountsData)) {
        if (!Array.isArray(chainAccounts)) continue
        for (const acct of chainAccounts) { if (acct.address) set.add(acct.address.toLowerCase()) }
      }
    }
    return set
  }, [trackedAccountsData])

  // ─── Events parsing ───
  const events = useMemo(() => {
    if (!data) return []
    if (Array.isArray(data)) return data
    if (data.entries && Array.isArray(data.entries)) return data.entries
    if (data.events && Array.isArray(data.events)) return data.events
    if (data.result) {
      if (Array.isArray(data.result)) return data.result
      if (data.result.entries) return data.result.entries
      if (data.result.events) return data.result.events
    }
    return []
  }, [data])

  const sentTokens = useMemo(() => {
    const set = new Set<string>()
    for (const evt of events) {
      const evtType = String(evt.event_type ?? evt.type ?? "").toLowerCase()
      if (evtType === "send" || evtType === "trade") {
        const symbol = String(evt.asset ?? "").trim().toUpperCase()
        if (symbol) set.add(symbol)
      }
    }
    return set
  }, [events])

  // ─── GoPlus Tier 2 enrichment ───
  const [goplusScores, setGoplusScores] = useState<Map<string, number>>(new Map())
  const goplusFetchedRef = useRef<string>("")

  useEffect(() => {
    if (events.length === 0) return
    const ambiguous: Array<{ contract: string; counterparty?: string }> = []
    const seen = new Set<string>()
    for (const evt of events) {
      const contract = evt.contract_address as string | null
      if (!contract) continue
      const lc = contract.toLowerCase()
      if (seen.has(lc)) continue
      const { score } = getSpamScore(evt as Record<string, unknown>, sentTokens)
      if (score >= 20 && score < 50) {
        seen.add(lc)
        ambiguous.push({ contract: lc, counterparty: (evt.counterparty as string) || undefined })
      }
    }
    if (ambiguous.length === 0) return
    const batchKey = ambiguous.map((c) => c.contract).sort().join(",")
    if (goplusFetchedRef.current === batchKey) return
    goplusFetchedRef.current = batchKey
    fetch("/api/portfolio/history/spam-check", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...csrfHeaders() },
      body: JSON.stringify({ tokens: ambiguous.slice(0, 20) }),
    })
      .then((res) => res.json())
      .then((resData) => {
        if (!resData.results) return
        const newScores = new Map<string, number>()
        for (const [contract, result] of Object.entries(resData.results)) {
          const r = result as { score: number }
          if (r.score > 0) newScores.set(contract, r.score)
        }
        if (newScores.size > 0) setGoplusScores((prev) => new Map([...prev, ...newScores]))
      })
      .catch(() => { /* best-effort */ })
  }, [events, sentTokens])

  // ─── Spam + flag filtering ───
  const filteredEvents = useMemo(
    () => hideSpam ? events.filter((e: Record<string, unknown>) => !isSpam(e, sentTokens, goplusScores)) : events,
    [events, hideSpam, sentTokens, goplusScores]
  )
  const spamCount = events.length - filteredEvents.length

  // ─── Sort + paginate ───
  const displayEvents = useMemo(() => {
    const base = showFlaggedOnly ? filteredEvents.filter((e: Record<string, unknown>) => e.isFlagged === true) : filteredEvents
    const sorted = [...base].sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
      let aVal: unknown, bVal: unknown
      switch (sortKey) {
        case "timestamp": aVal = a.timestamp ?? 0; bVal = b.timestamp ?? 0; break
        case "event_type": aVal = a.event_type ?? ""; bVal = b.event_type ?? ""; break
        case "source": aVal = a.source ?? ""; bVal = b.source ?? ""; break
        case "asset": aVal = (a.symbol ?? a.asset ?? "") as string; bVal = (b.symbol ?? b.asset ?? "") as string; break
        case "amount": aVal = Math.abs(Number(a.amount) || 0); bVal = Math.abs(Number(b.amount) || 0); break
        case "value": aVal = Number(a.usd_value) || 0; bVal = Number(b.usd_value) || 0; break
        default: return 0
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        const cmp = aVal.localeCompare(bVal as string)
        return sortDir === "asc" ? cmp : -cmp
      }
      const diff = (aVal as number) - (bVal as number)
      return sortDir === "asc" ? diff : -diff
    })
    return hideSpam ? sorted.slice(offset, offset + PAGE_SIZE) : sorted
  }, [filteredEvents, showFlaggedOnly, hideSpam, offset, sortKey, sortDir])

  const flaggedCount = useMemo(
    () => events.filter((e: Record<string, unknown>) => e.isFlagged === true).length,
    [events]
  )

  const totalFound = hideSpam
    ? (showFlaggedOnly ? filteredEvents.filter((e: Record<string, unknown>) => e.isFlagged === true).length : filteredEvents.length)
    : (data?.entries_found ?? data?.entries_total ?? data?.total ?? events.length)
  const totalPages = Math.max(1, Math.ceil(totalFound / PAGE_SIZE))
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  // ─── Sync status ───
  const syncJobStatus = syncData?.job?.status as string | undefined
  const syncIsRunning = syncJobStatus === "queued" || syncJobStatus === "running"
  const syncProcessed = Number(syncData?.processedSyncs ?? 0)
  const syncTotal = Number(syncData?.totalSyncs ?? 0)
  const syncFailed = Number(syncData?.failedSyncs ?? 0)

  return {
    data, isLoading, isFetching, isPlaceholderData, isError, error,
    events, displayEvents, filteredEvents, spamCount, flaggedCount,
    totalFound, totalPages, currentPage,
    addressNames, ownAddresses, sentTokens, goplusScores,
    connectedExchangeOptions, walletOptions,
    syncData, syncIsRunning, syncProcessed, syncTotal, syncFailed,
  }
}
