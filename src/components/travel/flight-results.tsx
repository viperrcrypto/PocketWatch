"use client"

import { useState, useMemo } from "react"
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

const SOURCE_LABELS: Record<string, string> = {
  roame: "Roame",
  pointme: "point.me",
  google: "Google",
  atf: "ATF",
  "hidden-city": "Hidden City",
}

function FilterPills<T extends string>({
  items, active, onChange,
}: { items: [T, string][]; active: T; onChange: (v: T) => void }) {
  return (
    <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-card-border">
      {items.map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            active === key ? "bg-primary/10 text-primary" : "text-foreground-muted hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function FlightList({ flights }: { flights: ValueScoredFlight[] }) {
  const hasLegs = flights.some(f => f.leg)

  if (flights.length === 0) return null

  if (!hasLegs) {
    return (
      <div className="space-y-2">
        {flights.map(f => <FlightResultCard key={f.id} flight={f} />)}
      </div>
    )
  }

  const outbound = flights.filter(f => f.leg === "outbound")
  const returnFlights = flights.filter(f => f.leg === "return")

  return (
    <>
      {outbound.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>flight_takeoff</span>
            Outbound ({outbound.length})
          </h3>
          {outbound.map(f => <FlightResultCard key={f.id} flight={f} />)}
        </div>
      )}
      {returnFlights.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-foreground-muted uppercase tracking-wide flex items-center gap-1.5">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>flight_land</span>
            Return ({returnFlights.length})
          </h3>
          {returnFlights.map(f => <FlightResultCard key={f.id} flight={f} />)}
        </div>
      )}
    </>
  )
}

export function FlightResults({ flights, onSearchCabin, isMultiSearch }: FlightResultsProps) {
  const [cabinFilter, setCabinFilter] = useState<CabinFilter>("all")
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all")
  const [stopsFilter, setStopsFilter] = useState<StopsFilter>("any")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortBy>("valueScore")
  const [airportFilter, setAirportFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("all")

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

  // Unique airport pairs and dates for multi-search filter pills
  const airportPairs = useMemo(() => {
    if (!isMultiSearch) return []
    const pairs = new Set<string>()
    for (const f of flights) {
      if (f.searchOrigin && f.searchDestination) pairs.add(`${f.searchOrigin}-${f.searchDestination}`)
    }
    return Array.from(pairs).sort()
  }, [flights, isMultiSearch])

  const searchDates = useMemo(() => {
    if (!isMultiSearch) return []
    const dates = new Set<string>()
    for (const f of flights) { if (f.searchDate) dates.add(f.searchDate) }
    return Array.from(dates).sort()
  }, [flights, isMultiSearch])

  // Compute filtered results
  let filtered = [...flights]
  if (cabinFilter !== "all") filtered = filtered.filter(f => f.cabinClass === cabinFilter)
  if (typeFilter !== "all") filtered = filtered.filter(f => f.type === typeFilter)
  if (stopsFilter !== "any") {
    const max = parseInt(stopsFilter)
    filtered = filtered.filter(f => f.stops <= max)
  }
  if (sourceFilter !== "all") filtered = filtered.filter(f => f.source === sourceFilter)
  if (airportFilter !== "all") {
    const [orig, dest] = airportFilter.split("-")
    filtered = filtered.filter(f => f.searchOrigin === orig && f.searchDestination === dest)
  }
  if (dateFilter !== "all") filtered = filtered.filter(f => f.searchDate === dateFilter)

  filtered.sort((a, b) => {
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

  const isFiltered = cabinFilter !== "all" || typeFilter !== "all" || stopsFilter !== "any"
    || sourceFilter !== "all" || airportFilter !== "all" || dateFilter !== "all"

  const clearAllFilters = () => {
    setCabinFilter("all")
    setTypeFilter("all")
    setStopsFilter("any")
    setSourceFilter("all")
    setAirportFilter("all")
    setDateFilter("all")
  }

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <FilterPills items={[["all","All"],["economy","Economy"],["business","Business"],["first","First"]]} active={cabinFilter} onChange={setCabinFilter} />
        <FilterPills items={[["all","All"],["award","Award"],["cash","Cash"]]} active={typeFilter} onChange={setTypeFilter} />
        <FilterPills items={[["any","Any"],["0","Nonstop"],["1","1 Stop"],["2","2 Stops"]]} active={stopsFilter} onChange={setStopsFilter} />

        {sources.length > 1 && (
          <FilterPills
            items={[["all", "All Sources"] as [string, string], ...sources.map(s => [s, SOURCE_LABELS[s] || s] as [string, string])]}
            active={sourceFilter}
            onChange={setSourceFilter}
          />
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
            <FilterPills
              items={[["all", "All Airports"] as [string, string], ...airportPairs.map(p => [p, p.replace("-", " → ")] as [string, string])]}
              active={airportFilter}
              onChange={setAirportFilter}
            />
          )}
          {searchDates.length > 1 && (
            <FilterPills
              items={[["all", "All Dates"] as [string, string], ...searchDates.map(d => [d, new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })] as [string, string])]}
              active={dateFilter}
              onChange={setDateFilter}
            />
          )}
        </div>
      )}

      {/* Results count + clear */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-foreground-muted">
          {filtered.length} flight{filtered.length !== 1 ? "s" : ""}
          {isFiltered ? ` of ${flights.length}` : ""}
        </p>
        {isFiltered && (
          <button
            onClick={clearAllFilters}
            className="text-[11px] text-primary hover:text-primary/80 transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Flight cards */}
      {filtered.length > 0 && <FlightList flights={filtered} />}

      {/* Empty state */}
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
}
