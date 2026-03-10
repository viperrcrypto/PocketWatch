"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  useAirdrops,
  useScanAirdrops,
  useVestingClaims,
  useScanVestingClaims,
} from "@/hooks/use-portfolio-tracker"
import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { PortfolioDataTable } from "@/components/portfolio/portfolio-data-table"
import { PortfolioEmpty } from "@/components/portfolio/portfolio-empty"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { StakingView } from "@/components/portfolio/staking-view"
import type { AirdropResult, AirdropScanResponse } from "@/lib/portfolio/airdrop-types"

import { FILTER_TABS, type ViewTab, type FilterTab, type VestingClaimsResponse } from "@/components/portfolio/airdrops/airdrops-constants"
import { vestingClaimsToAirdrops } from "@/components/portfolio/airdrops/airdrops-helpers"
import { AirdropsViewTabs } from "@/components/portfolio/airdrops/airdrops-view-tabs"
import { getAirdropColumns } from "@/components/portfolio/airdrops/airdrops-columns"
import { AirdropsDepletedSection } from "@/components/portfolio/airdrops/airdrops-depleted-section"

export default function AirdropsPage() {
  const [activeView, setActiveView] = useState<ViewTab>("vesting")
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all")
  const [sortKey, setSortKey] = useState("status")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const { data: rawAirdropData, isLoading: airdropsLoading, isError: airdropsError } = useAirdrops()
  const airdropScanMutation = useScanAirdrops()
  const { data: rawVestingData, isLoading: vestingLoading, isError: vestingError } = useVestingClaims()
  const vestingScanMutation = useScanVestingClaims()

  // Auto-scan airdrops on first visit
  const hasAutoScannedAirdrops = useRef(false)
  useEffect(() => {
    if (!airdropsLoading && !airdropsError && !hasAutoScannedAirdrops.current) {
      const data = rawAirdropData as AirdropScanResponse | null
      const hasAirdrops = data?.airdrops && Array.isArray(data.airdrops) && data.airdrops.length > 0
      const hasLegacyData = rawAirdropData && typeof rawAirdropData === "object" && Object.keys(rawAirdropData as object).some((k) => k.startsWith("0x"))
      if (!hasAirdrops && !hasLegacyData && !airdropScanMutation.isPending) {
        hasAutoScannedAirdrops.current = true
        airdropScanMutation.mutate()
      }
    }
  }, [airdropsLoading, airdropsError, rawAirdropData, airdropScanMutation])

  // Auto-scan vesting claims on first visit
  const hasAutoScannedVesting = useRef(false)
  useEffect(() => {
    if (!vestingLoading && !vestingError && !hasAutoScannedVesting.current) {
      const data = rawVestingData as VestingClaimsResponse | null
      const hasClaims = data?.claims && Array.isArray(data.claims) && data.claims.length > 0
      if (!hasClaims && !vestingScanMutation.isPending) {
        hasAutoScannedVesting.current = true
        vestingScanMutation.mutate()
      }
    }
  }, [vestingLoading, vestingError, rawVestingData, vestingScanMutation])

  // ─── Parse airdrop response ───
  const { airdrops: parsedAirdrops, summary: airdropSummary } = useMemo(() => {
    if (!rawAirdropData || typeof rawAirdropData !== "object") return { airdrops: [] as AirdropResult[], summary: null }
    const scanResponse = rawAirdropData as AirdropScanResponse
    if (scanResponse.airdrops && Array.isArray(scanResponse.airdrops)) {
      return { airdrops: scanResponse.airdrops, summary: scanResponse.summary }
    }
    // Legacy Rotki format
    const parsed: AirdropResult[] = []
    for (const [address, protocols] of Object.entries(rawAirdropData as Record<string, unknown>)) {
      if (!protocols || typeof protocols !== "object" || !address.startsWith("0x")) continue
      for (const [protocolId, details] of Object.entries(protocols as Record<string, unknown>)) {
        const d = details as Record<string, unknown>
        const amount = parseFloat(String(d?.amount || "0"))
        const claimed = d?.claimed === true
        parsed.push({
          id: `${protocolId}:${address}`, protocol: protocolId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          token: String(d?.asset || protocolId.toUpperCase()), chain: "ETH", amount, usdValue: null,
          status: claimed ? "claimed" : "claimable",
          claimUrl: d?.link ? String(d.link) : d?.claim_url ? String(d.claim_url) : d?.claimUrl ? String(d.claimUrl) : null,
          iconUrl: null, deadline: null, deadlineDaysLeft: null, source: "rotki", address,
        })
      }
    }
    return { airdrops: parsed, summary: null }
  }, [rawAirdropData])

  const { active: vestingAirdrops, depleted: depletedVesting } = useMemo(() => vestingClaimsToAirdrops(rawVestingData as VestingClaimsResponse | null), [rawVestingData])
  const vestingSummary = (rawVestingData as VestingClaimsResponse | null)?.summary ?? null

  const isLoading = activeView === "staking" ? false : activeView === "airdrops" ? airdropsLoading : vestingLoading
  const isError = activeView === "staking" ? false : activeView === "airdrops" ? airdropsError : vestingError
  const airdrops = activeView === "staking" ? [] : activeView === "airdrops" ? parsedAirdrops : vestingAirdrops
  const isScanning = activeView === "staking" ? false : activeView === "airdrops" ? airdropScanMutation.isPending : vestingScanMutation.isPending

  // ─── Filter + Sort ───
  const filteredAirdrops = useMemo(() => {
    if (activeFilter === "all") return airdrops
    if (activeFilter === "locked") return airdrops.filter((a) => a.status === "unclaimed" && a.source === "vesting")
    return airdrops.filter((a) => a.status === activeFilter)
  }, [airdrops, activeFilter])

  const sortedAirdrops = useMemo(() => {
    const sorted = [...filteredAirdrops]
    sorted.sort((a, b) => {
      let aVal: number | string; let bVal: number | string
      switch (sortKey) {
        case "protocol": aVal = a.protocol.toLowerCase(); bVal = b.protocol.toLowerCase(); break
        case "chain": aVal = a.chain.toLowerCase(); bVal = b.chain.toLowerCase(); break
        case "amount": aVal = a.amount; bVal = b.amount; break
        case "usdValue": aVal = a.usdValue ?? 0; bVal = b.usdValue ?? 0; break
        case "deadline": aVal = a.deadline ? new Date(a.deadline).getTime() : 0; bVal = b.deadline ? new Date(b.deadline).getTime() : 0; break
        case "status": default: {
          const order: Record<string, number> = { claimable: 0, unclaimed: 1, unknown: 2, expired: 3, claimed: 4 }
          aVal = order[a.status] ?? 5; bVal = order[b.status] ?? 5; break
        }
      }
      if (typeof aVal === "string" && typeof bVal === "string") return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return sorted
  }, [filteredAirdrops, sortKey, sortDir])

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    else { setSortKey(key); setSortDir("desc") }
  }

  const handleRefresh = () => {
    if (activeView === "airdrops" && !airdropScanMutation.isPending) airdropScanMutation.mutate()
    else if (activeView === "vesting" && !vestingScanMutation.isPending) vestingScanMutation.mutate()
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: airdrops.length }
    for (const a of airdrops) {
      c[a.status] = (c[a.status] || 0) + 1
      if (a.source === "vesting" && a.status === "unclaimed") c["locked"] = (c["locked"] || 0) + 1
    }
    return c
  }, [airdrops])

  const vestingClaimCount = useMemo(() => vestingAirdrops.filter((a) => a.status === "claimable").length, [vestingAirdrops])
  const columns = useMemo(() => getAirdropColumns(activeView), [activeView])
  const scanError = activeView === "airdrops" ? airdropScanMutation.isError : vestingScanMutation.isError

  const activeChainsChecked = activeView === "airdrops" ? airdropSummary?.chainsChecked : vestingSummary?.chainsChecked
  const activeScannedAt = activeView === "airdrops" ? airdropSummary?.scannedAt : vestingSummary?.scannedAt
  const activeFromCache = activeView === "airdrops" ? (rawAirdropData as AirdropScanResponse)?.meta?.fromCache : (rawVestingData as VestingClaimsResponse)?.meta?.fromCache
  const platformsChecked = vestingSummary?.platformsChecked ?? []

  // ─── Scan Button ───
  const scanButton = (
    <div className="flex items-center gap-3">
      {scanError && <span className="text-error text-xs font-medium">Scan failed — try again</span>}
      <button onClick={handleRefresh} disabled={isScanning}
        className={`flex items-center gap-2 px-4 py-2 border transition-all rounded-xl ${isScanning ? "bg-background-secondary border-primary/30 cursor-wait" : "bg-background-secondary border-card-border hover:border-primary/50 hover:text-primary"}`}
        style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", color: isScanning ? "var(--primary)" : undefined }}>
        <span className={`material-symbols-rounded ${isScanning ? "animate-spin" : ""}`} style={{ fontSize: 16 }}>
          {isScanning ? "progress_activity" : "radar"}
        </span>
        {isScanning ? "Scanning..." : "Scan Now"}
      </button>
    </div>
  )

  // ─── Scanning state ───
  if (!isLoading && isScanning && airdrops.length === 0) {
    return (
      <div className="space-y-6">
        <PortfolioPageHeader title="Airdrops & Staking" subtitle="Airdrops, vesting claims, and DeFi staking positions" actions={scanButton} />
        <AirdropsViewTabs activeView={activeView} onViewChange={setActiveView} vestingClaimCount={vestingClaimCount} />
        <div className="bg-card border border-card-border p-6 rounded-xl flex items-center gap-3">
          <span className="material-symbols-rounded animate-spin text-primary">progress_activity</span>
          <span className="text-sm text-secondary">Scanning for vesting claims across Sablier, Hedgey, LlamaPay, Team.Finance, and Streamflow...</span>
        </div>
      </div>
    )
  }

  // ─── Empty / Error state ───
  if (!isLoading && !isScanning && (isError || airdrops.length === 0) && activeView !== "staking") {
    return (
      <div className="space-y-6">
        <PortfolioPageHeader title="Airdrops & Staking" subtitle="Airdrops, vesting claims, and DeFi staking positions" actions={scanButton} />
        <AirdropsViewTabs activeView={activeView} onViewChange={setActiveView} vestingClaimCount={vestingClaimCount} />
        {isError && (
          <div className="bg-card border border-card-border p-6 rounded-xl">
            <div className="flex items-center gap-3 text-error">
              <span className="material-symbols-rounded">error</span>
              <span className="text-sm">Failed to load data. Please try again.</span>
            </div>
          </div>
        )}
        {!isError && (
          <PortfolioEmpty
            icon={activeView === "vesting" ? "lock_clock" : "redeem"}
            title={activeView === "vesting" ? "No Streams or Vesting Claims Found" : "No Airdrops Found"}
            description={activeView === "vesting"
              ? "Streams and vesting claims will appear here when we detect unclaimed tokens on platforms like Sablier, Hedgey, LlamaPay, Team.Finance, and Streamflow. Click 'Scan Now' to check."
              : "Click 'Scan Now' to check for claimable airdrops across Merkl, deBridge, and other protocols. We also check your Zerion reward positions for unclaimed DeFi rewards."}
          />
        )}
      </div>
    )
  }

  // ─── Main content ───
  return (
    <div className="space-y-6">
      <PortfolioPageHeader title="Airdrops & Staking" subtitle="Airdrops, vesting claims, and DeFi staking positions"
        actions={activeView !== "staking" ? scanButton : undefined} />

      <AirdropsViewTabs activeView={activeView} onViewChange={(v) => { setActiveView(v); setActiveFilter("all") }} vestingClaimCount={vestingClaimCount} />

      {activeView === "staking" && <StakingView />}

      {/* Summary Cards */}
      {activeView !== "staking" && !isLoading && airdrops.length > 0 && (
        <div className={`grid grid-cols-1 ${activeView === "vesting" ? "sm:grid-cols-4" : "sm:grid-cols-3"} gap-4`}>
          <div className="bg-card border border-card-border p-4 rounded-xl">
            <span className="block text-foreground-muted mb-1 text-xs font-semibold">{activeView === "vesting" ? "Claimable Now" : "Total Unclaimed"}</span>
            <span className="text-success font-data text-2xl font-semibold">
              {activeView === "vesting" ? (counts.claimable || 0) : (counts.claimable || 0) + (counts.unclaimed || 0)}
            </span>
          </div>
          <div className="bg-card border border-card-border p-4 rounded-xl">
            <span className="block text-foreground-muted mb-1 text-xs font-semibold">{activeView === "vesting" ? "Still Vesting" : "Confirmed Claimable"}</span>
            <span className={`font-data text-2xl font-semibold ${activeView === "vesting" ? "text-primary" : "text-success"}`}>
              {activeView === "vesting" ? (counts.locked || counts.unclaimed || 0) : (counts.claimable || 0)}
            </span>
          </div>
          {activeView === "vesting" && (
            <div className="bg-card border border-card-border p-4 rounded-xl">
              <span className="block text-foreground-muted mb-1 text-xs font-semibold">Platforms Checked</span>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {platformsChecked.map((p) => (
                  <span key={p} className="text-foreground-muted bg-card-elevated px-2 py-0.5 rounded text-[9px] font-semibold">{p}</span>
                ))}
                {platformsChecked.length === 0 && <span className="text-foreground-muted text-sm">--</span>}
              </div>
            </div>
          )}
          <div className="bg-card border border-card-border p-4 rounded-xl">
            <span className="block text-foreground-muted mb-1 text-xs font-semibold">Chains Checked</span>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {activeChainsChecked?.map((chain) => <ChainBadge key={chain} chainId={chain} size="sm" />) || <span className="text-foreground-muted text-sm">--</span>}
            </div>
          </div>
        </div>
      )}

      {/* Vesting scan errors */}
      {activeView === "vesting" && vestingSummary?.errors && vestingSummary.errors.length > 0 && (
        <div className="bg-card border border-warning/20 p-3 flex items-start gap-2 rounded-xl">
          <span className="material-symbols-rounded text-warning shrink-0" style={{ fontSize: 16, marginTop: 1 }}>warning</span>
          <div className="flex flex-col gap-1">
            <span className="text-warning text-xs font-semibold">Some platforms had scan issues:</span>
            {vestingSummary.errors.map((err, i) => <span key={i} className="text-foreground-muted text-xs">{err}</span>)}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {activeView !== "staking" && !isLoading && airdrops.length > 0 && (
        <div className="flex gap-1 bg-background-secondary border border-card-border p-1 rounded-xl">
          {FILTER_TABS
            .filter((tab) => {
              if (activeView === "airdrops" && tab.key === "locked") return false
              if (activeView === "vesting" && tab.key === "expired") return false
              return true
            })
            .map((tab) => {
              const isActive = activeFilter === tab.key
              const count = counts[tab.key] || 0
              return (
                <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 transition-all rounded-lg text-xs ${isActive ? "font-semibold text-foreground bg-card" : "font-normal text-foreground-muted"}`}>
                  {tab.label}
                  <span className={`text-[9px] font-semibold ${isActive ? "text-primary" : "text-foreground-muted/50"}`}>{count}</span>
                </button>
              )
            })}
        </div>
      )}

      {/* Last scanned indicator */}
      {activeView !== "staking" && activeScannedAt && !isLoading && (
        <div className="flex items-center gap-2 px-1">
          <span className="material-symbols-rounded text-foreground-muted/50" style={{ fontSize: 14 }}>schedule</span>
          <span className="text-foreground-muted/50 text-xs">
            Last scan: {new Date(activeScannedAt).toLocaleString()}
            {activeView === "airdrops" && airdropSummary?.registryVersion ? ` • Registry ${airdropSummary.registryVersion}` : ""}
          </span>
          {activeFromCache && (
            <span className="text-foreground-muted/70 text-[9px] px-1.5 py-0.5 bg-foreground-muted/5 rounded">CACHED</span>
          )}
        </div>
      )}

      {activeView !== "staking" && (
        <PortfolioDataTable
          columns={columns} data={sortedAirdrops} isLoading={isLoading}
          emptyMessage={activeView === "vesting" ? "No vesting claims match the selected filter" : "No airdrops match the selected filter"}
          emptyIcon={activeView === "vesting" ? "lock_clock" : "redeem"}
          sortKey={sortKey} sortDir={sortDir} onSort={handleSort}
        />
      )}

      {activeView === "vesting" && !isLoading && (
        <AirdropsDepletedSection items={depletedVesting} />
      )}
    </div>
  )
}
