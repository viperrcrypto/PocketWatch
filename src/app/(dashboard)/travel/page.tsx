"use client"

import { useState, useCallback, useEffect } from "react"
import { useFlightSearch, useTravelBalances } from "@/hooks/travel"
import { useChat } from "@/hooks/use-chat"
import { FlightSearchForm } from "@/components/travel/flight-search-form"
import { FlightResults } from "@/components/travel/flight-results"
import { PocketWatchPicks } from "@/components/travel/pocketwatch-picks"
import { RecommendationsPanel } from "@/components/travel/recommendations-panel"
import { BalancesPanel } from "@/components/travel/balances-panel"
import { InsightsBanner } from "@/components/travel/insights-banner"
import type { SearchConfig } from "@/types/travel"

export default function TravelPage() {
  const { status, progress, results, error, search, isSearching, recentSearches } = useFlightSearch()
  const { data: balancesData } = useTravelBalances()
  const { isOpen: chatOpen, setPageContext } = useChat()
  const [lastConfig, setLastConfig] = useState<SearchConfig | null>(null)
  const [filteredFlights, setFilteredFlights] = useState<import("@/types/travel").ValueScoredFlight[]>([])
  // Tell PocketLLM about flight results so the AI can answer questions
  useEffect(() => {
    if (results) {
      setPageContext({
        page: "flight-search",
        summary: `${results.flights.length} flights: ${results.meta.origin} → ${results.meta.destination}, ${results.meta.departureDate}`,
      })
    } else {
      setPageContext(null)
    }
    return () => setPageContext(null)
  }, [results, setPageContext])

  const handlePickClick = useCallback((flightId: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(`flight-${flightId}`)
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" })
        el.style.boxShadow = "0 0 0 2px #818cf8"
        setTimeout(() => { el.style.boxShadow = "" }, 2000)
      }
    })
  }, [])

  const handleSearch = useCallback((config: SearchConfig) => {
    setLastConfig(config)
    search(config, true)
  }, [search])

  const handleSearchCabin = useCallback((searchClass: string) => {
    if (!lastConfig) return
    const newConfig: SearchConfig = { ...lastConfig, searchClass: searchClass as SearchConfig["searchClass"] }
    setLastConfig(newConfig)
    search(newConfig)
  }, [lastConfig, search])

  return (
    <div className="py-6 space-y-6">
      <FlightSearchForm
        onSearch={handleSearch}
        isSearching={isSearching}
        progress={progress}
        recentSearches={recentSearches}
      />

      {error && (
        <div className="card p-4 border-l-4" style={{ borderLeftColor: "var(--error)" }}>
          <p className="text-sm text-red-400 font-medium">Search failed</p>
          <p className="text-xs text-foreground-muted mt-1">{error}</p>
        </div>
      )}

      {results && (
        <div className={`grid grid-cols-1 ${chatOpen ? "2xl:grid-cols-[1fr_300px]" : "lg:grid-cols-[1fr_300px]"} gap-6`}>
          {/* Main content */}
          <div className="space-y-6 min-w-0">
            {/* Insights */}
            {results.insights.length > 0 && (
              <InsightsBanner insights={results.insights} />
            )}

            {/* Warnings */}
            {results.warnings.length > 0 && (
              <div className="space-y-1">
                {results.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-400/80">{w}</p>
                ))}
              </div>
            )}

            {/* PocketWatch Picks */}
            <PocketWatchPicks
              flights={filteredFlights.length > 0 ? filteredFlights : results.flights}
              isMultiSearch={!!(results.meta.origins || results.meta.destinations || results.meta.flexDates)}
              onPickClick={handlePickClick}
            />

            {/* Flight results */}
            <FlightResults
              flights={results.flights}
              onSearchCabin={handleSearchCabin}
              isMultiSearch={!!(results.meta.origins || results.meta.destinations || results.meta.flexDates)}
              onFilteredChange={setFilteredFlights}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <RecommendationsPanel recommendations={results.recommendations} />
            <BalancesPanel balances={results.balances} />

            {/* Route sweet spots */}
            {results.routeSweetSpots.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-bold text-foreground mb-2">Route Sweet Spots</h3>
                <div className="space-y-2">
                  {results.routeSweetSpots.map((spot, i) => (
                    <div key={i} className="text-xs">
                      <p className="font-medium text-foreground">{spot.program} {spot.cabin}</p>
                      <p className="text-foreground-muted text-[11px]">
                        {spot.maxPoints.toLocaleString()} pts max — {spot.description.slice(0, 60)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {status === "idle" && !results && (
        <div className="card p-12 text-center">
          <span className="material-symbols-rounded text-foreground-muted/30 mb-3 block" style={{ fontSize: 48 }}>
            flight_takeoff
          </span>
          <p className="text-sm text-foreground-muted">
            Search for flights to see personalized award recommendations based on your points balances.
          </p>
          {balancesData?.balances && balancesData.balances.length > 0 && (
            <p className="text-xs text-foreground-muted/70 mt-2">
              {balancesData.balances.length} points programs loaded from your cards
            </p>
          )}
        </div>
      )}
    </div>
  )
}
