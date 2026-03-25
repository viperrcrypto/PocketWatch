"use client"

import { useState, useMemo, forwardRef, useImperativeHandle } from "react"
import type { ValueScoredFlight } from "@/types/travel"
import { FlightResultCard } from "./flight-result-card"
import { cn } from "@/lib/utils"

interface FlightResultsProps {
  flights: ValueScoredFlight[]
  onSearchCabin?: (cabin: string) => void
  isMultiSearch?: boolean
}

type CabinFilter = "all" | "economy" | "business" | "first"
type TypeFilter = "all" | "award" | "cash"
type StopsFilter = "any" | "0" | "1" | "2"
type SortBy = "valueScore" | "price" | "cpp" | "duration"

export interface FlightResultsHandle {
  clearFilters: () => void
}

export const FlightResults = forwardRef<FlightResultsHandle, FlightResultsProps>(function FlightResults({ flights, onSearchCabin, isMultiSearch }, ref) {
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>("any")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortBy>("valueScore")
  const [airportFilter, setAirportFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")

  useImperativeHandle(ref, () => ({
    clearFilters() {
      setCabinFilter("all")
      setTypeFilter("all")
      setStopsFilter("any")
      setSourceFilter("all")
      setAirportFilter("all")
      setDateFilter("all")
    },
  }))

  // Unique sources for filter pills
  const sources = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of flights) {
      counts.set(f.source, (counts.get(f.source) || 0) + 1)
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([source]) => source)
  }, [flights])

  const SOURCE_LABELS: Record<string, string> = {
    roame: "Roame",
    pointme: "point.me",
    google: "Google",
    atf: "ATF",
    "hidden-city": "Hidden City",
  }

  // Unique airport pairs and dates for filter pills
  const airportPairs = useMemo(() => {
    if (!isMultiSearch) return []
    const pairs = new Set<string>()
    for (const f of flights) {
      if (f.searchOrigin && f.searchDestination) {
        pairs.add(`${f.searchOrigin}-${f.searchDestination}`)
      }
    }
    return Array.from(pairs).sort()
  }, [flights, isMultiSearch])

  const searchDates = useMemo(() => {
    if (!isMultiSearch) return []
    const dates = new Set<string>()
    for (const f of flights) {
      if (f.searchDate) dates.add(f.searchDate)
    }
    return Array.from(dates).sort()
  }, [flights, isMultiSearch])

  const filtered = (() => {
    let result = [...flights]

    if (cabinFilter !== "all") {
      result = result.filter(f => f.cabinClass === cabinFilter)
    }
    if (typeFilter !== "all") {
      result = result.filter(f => f.type === typeFilter)
    }
    if (stopsFilter !== "any") {
      const maxStops = parseInt(stopsFilter)
      result = result.filter(f => f.stops <= maxStops)
    }
    if (sourceFilter !== "all") {
      result = result.filter(f => f.source === sourceFilter)
    }
    if (airportFilter !== "all") {
      const [orig, dest] = airportFilter.split("-")
      result = result.filter(f => f.searchOrigin === orig && f.searchDestination === dest)
    }
    if (dateFilter !== "all") {
      result = result.filter(f => f.searchDate === dateFilter)
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "valueScore": return b.valueScore - a.valueScore
        case "price":
          if (a.type === "cash" && b.type === "cash") return (a.cashPrice || 0) - (b.cashPrice || 0)
          return (a.points || 0) - (b.points || 0)
        case "cpp": return (b.realCpp || 0) - (a.realCpp || 0)
        case "duration": return a.durationMinutes - b.durationMinutes
        default: return 0
      }
    })

    return result
  })()

  const hasLegs = filtered.some(f => f.leg)
  const outboundFiltered = hasLegs ? filtered.filter(f => f.leg === "outbound") : []
  const returnFiltered = hasLegs ? filtered.filter(f => f.leg === "return") : []

  const cabins: { key: CabinFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "economy", label: "Economy" },
    { key: "business", label: "Business" },
    { key: "first", label: "First" },
  ]

  const types: { key: TypeFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "award", label: "Award" },
    { key: "cash", label: "Cash" },
  ]

  const stops: { key: StopsFilter; label: string }[] = [
    { key: "any", label: "Any" },
    { key: "0", label: "Nonstop" },
    { key: "1", label: "1 Stop" },
    { key: "2", label: "2 Stops" },
  ]

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-card-border">
          {cabins.map(c => (
            <button
              key={c.key}
              onClick={() => setCabinFilter(c.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                cabinFilter === c.key
                  ? "bg-primary/10 text-primary"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-card-border">
          {types.map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                typeFilter === t.key
                  ? "bg-primary/10 text-primary"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-card-border">
          {stops.map(s => (
            <button
              key={s.key}
              onClick={() => setStopsFilter(s.key)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                stopsFilter === s.key
                  ? "bg-primary/10 text-primary"
                  : "text-foreground-muted hover:text-foreground"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {sources.length > 1 && (
          <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-card-border">
            <button
              onClick={() => setSourceFilter("all")}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                sourceFilter === "all" ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground"
              )}
            >
              All Sources
            </button>
            {sources.map(s => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  sourceFilter === s ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground"
                )}
              >
                {SOURCE_LABELS[s] || s}
              </button>
            ))}
          </div>
        )}

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
          className="bg-card border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground ml-auto"
        >
          <option value="valueScore">Best Value</option>
          <option value="price">Lowest Price</option>
          <option value="cpp">Highest CPP</option>
          <option value="duration">Shortest Duration</option>
        </select>
      </div>

      {/* Multi-search filter pills */}
      {isMultiSearch && (airportPairs.length > 1 || searchDates.length > 1) && (
        <div className="flex items-center gap-3 flex-wrap">
          {airportPairs.length > 1 && (
            <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-card-border">
              <button
                onClick={() => setAirportFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  airportFilter === "all" ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground"
                )}
              >
                All Airports
              </button>
              {airportPairs.map(pair => (
                <button
                  key={pair}
                  onClick={() => setAirportFilter(pair)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors",
                    airportFilter === pair ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground"
                  )}
                >
                  {pair.replace("-", " → ")}
                </button>
              ))}
            </div>
          )}
          {searchDates.length > 1 && (
            <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-card-border">
              <button
                onClick={() => setDateFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                  dateFilter === "all" ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground"
                )}
              >
                All Dates
              </button>
              {searchDates.map(d => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
                    dateFilter === d ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground"
                  )}
                >
                  {new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-foreground-muted">
        {filtered.length} flight{filtered.length !== 1 ? "s" : ""}
        {cabinFilter !== "all" || typeFilter !== "all" || stopsFilter !== "any" || sourceFilter !== "all" || airportFilter !== "all" || dateFilter !== "all" ? " (filtered)" : ""}
      </p>

      {/* Result cards — grouped by leg when round-trip */}
      {filtered.length > 0 && hasLegs ? (
        <>
          {outboundFiltered.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>flight_takeoff</span>
                Outbound ({outboundFiltered.length})
              </h3>
              {outboundFiltered.map((flight) => (
                <FlightResultCard key={`${flight.id}-ob`} flight={flight} />
              ))}
            </div>
          )}
          {returnFiltered.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wide flex items-center gap-1.5">
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>flight_land</span>
                Return ({returnFiltered.length})
              </h3>
              {returnFiltered.map((flight) => (
                <FlightResultCard key={`${flight.id}-rt`} flight={flight} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {filtered.map((flight) => (
            <FlightResultCard key={flight.id} flight={flight} />
          ))}
        </div>
      )}

      {filtered.length === 0 && (
        <div className="card p-8 text-center">
          <span className="material-symbols-rounded text-foreground-muted mb-2 block" style={{ fontSize: 32 }}>
            flight_land
          </span>
          <p className="text-sm text-foreground-muted">No flights match your filters.</p>
          {cabinFilter !== "all" && onSearchCabin && (
            <button
              onClick={() => {
                const classMap: Record<string, string> = { economy: "ECON", business: "PREM", first: "PREM" }
                onSearchCabin(classMap[cabinFilter] || "PREM")
              }}
              className="mt-3 btn-primary text-xs px-4 py-2 rounded-lg"
            >
              Search {cabinFilter.charAt(0).toUpperCase() + cabinFilter.slice(1)} Class
            </button>
          )}
        </div>
      )}
    </div>
  )
})
