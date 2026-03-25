"use client"

import { useState, useMemo } from "react"
import type { SearchConfig, SearchProgressEvent } from "@/types/travel"
import type { RecentSearch } from "@/hooks/travel/use-flight-search"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"
import { AirportInput } from "./airport-input"
import { NearbyAirportChips } from "./nearby-airport-chips"

interface FlightSearchFormProps {
  onSearch: (config: SearchConfig) => void
  isSearching: boolean
  progress: SearchProgressEvent[]
  recentSearches?: RecentSearch[]
}

export function FlightSearchForm({ onSearch, isSearching, progress, recentSearches = [] }: FlightSearchFormProps) {
  const [origin, setOrigin] = useState("")
  const [destination, setDestination] = useState("")
  const [date, setDate] = useState("")
  const [returnDate, setReturnDate] = useState("")
  const [searchClass, setSearchClass] = useState<SearchConfig["searchClass"]>("PREM")
  const [tripType, setTripType] = useState<"one_way" | "round_trip">("one_way")
  const [flexDates, setFlexDates] = useState(false)

  // Parse codes from comma-separated input for nearby suggestions
  const originCodes = useMemo(() => origin.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s)), [origin])
  const destCodes = useMemo(() => destination.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s)), [destination])

  const addNearbyAirport = (field: "origin" | "destination", code: string) => {
    if (field === "origin") {
      setOrigin(prev => prev ? `${prev},${code}` : code)
    } else {
      setDestination(prev => prev ? `${prev},${code}` : code)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!origin || !destination || !date) return
    if (tripType === "round_trip" && !returnDate) return

    const parsedOrigins = origin.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s))
    const parsedDests = destination.split(",").map(s => s.trim().toUpperCase()).filter(s => /^[A-Z]{3}$/.test(s))
    if (parsedOrigins.length === 0 || parsedDests.length === 0) return

    onSearch({
      origin: parsedOrigins[0]!,
      destination: parsedDests[0]!,
      departureDate: date,
      searchClass,
      tripType,
      ...(tripType === "round_trip" ? { returnDate } : {}),
      ...(flexDates ? { flexDates: true } : {}),
      ...(parsedOrigins.length > 1 ? { origins: parsedOrigins } : {}),
      ...(parsedDests.length > 1 ? { destinations: parsedDests } : {}),
    })
  }

  const handleRecentClick = (recent: RecentSearch) => {
    const originDisplay = recent.origins?.join(",") || recent.origin
    const destDisplay = recent.destinations?.join(",") || recent.destination
    setOrigin(originDisplay)
    setDestination(destDisplay)
    setDate(recent.date)
    setSearchClass(recent.searchClass)
    setTripType(recent.tripType || "one_way")
    setReturnDate(recent.returnDate || "")
    setFlexDates(recent.flexDates || false)
    onSearch({
      origin: recent.origin,
      destination: recent.destination,
      departureDate: recent.date,
      searchClass: recent.searchClass,
      tripType: recent.tripType || "one_way",
      ...(recent.returnDate ? { returnDate: recent.returnDate } : {}),
      ...(recent.flexDates ? { flexDates: true } : {}),
      ...(recent.origins ? { origins: recent.origins } : {}),
      ...(recent.destinations ? { destinations: recent.destinations } : {}),
    })
  }

  const classOptions: { key: SearchConfig["searchClass"]; label: string }[] = [
    { key: "ECON", label: "Economy" },
    { key: "PREM", label: "Business/First" },
    { key: "both", label: "All Cabins" },
  ]

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>flight_takeoff</span>
        <h2 className="text-sm font-bold text-foreground">Search Flights</h2>
      </div>

      {/* Trip type toggle */}
      <div className="flex items-center gap-1 bg-background rounded-lg p-1 border border-card-border w-fit">
        {(["one_way", "round_trip"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTripType(t)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              tripType === t
                ? "bg-primary/10 text-primary"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            {t === "one_way" ? "One-way" : "Round-trip"}
          </button>
        ))}
      </div>

      <div className={cn("grid grid-cols-2 gap-3", tripType === "round_trip" ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
        {/* Origin */}
        <div>
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            From
          </label>
          <AirportInput value={origin} onChange={setOrigin} placeholder="City or airport" required />
          <NearbyAirportChips codes={originCodes} field="origin" onAdd={addNearbyAirport} />
        </div>

        {/* Destination */}
        <div>
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            To
          </label>
          <AirportInput value={destination} onChange={setDestination} placeholder="City or airport" required />
          <NearbyAirportChips codes={destCodes} field="destination" onAdd={addNearbyAirport} />
        </div>

        {/* Departure Date */}
        <div>
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            {tripType === "round_trip" ? "Depart" : "Date"}
          </label>
          <DatePicker
            value={date}
            onChange={setDate}
            min={new Date().toISOString().split("T")[0]}
            placeholder="Select date"
            required
          />
        </div>

        {/* Return Date (round-trip only) */}
        {tripType === "round_trip" && (
          <div>
            <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
              Return
            </label>
            <DatePicker
              value={returnDate}
              onChange={setReturnDate}
              min={date || new Date().toISOString().split("T")[0]}
              placeholder="Return date"
              required
            />
          </div>
        )}

        {/* Class */}
        <div>
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            Cabin
          </label>
          <select
            value={searchClass}
            onChange={(e) => setSearchClass(e.target.value as SearchConfig["searchClass"])}
            className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            {classOptions.map(opt => (
              <option key={opt.key} value={opt.key}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Flex dates toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFlexDates(!flexDates)}
          className={cn(
            "text-xs px-3 py-1.5 rounded-full font-medium transition-colors border",
            flexDates
              ? "bg-primary/10 text-primary border-primary/30"
              : "bg-background text-foreground-muted border-card-border hover:text-foreground"
          )}
        >
          <span className="material-symbols-rounded align-middle mr-1" style={{ fontSize: 14 }}>date_range</span>
          Flexible +/- 1 day
        </button>
        {flexDates && date && (
          <span className="text-[11px] text-foreground-muted">
            {(() => {
              const d = new Date(date + "T12:00:00")
              const prev = new Date(d); prev.setDate(d.getDate() - 1)
              const next = new Date(d); next.setDate(d.getDate() + 1)
              const fmt = (dt: Date) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              return `${fmt(prev)} – ${fmt(next)}`
            })()}
          </span>
        )}
      </div>

      {/* Search button */}
      <button
        type="submit"
        disabled={isSearching || !origin || !destination || !date}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
          isSearching
            ? "bg-primary/20 text-primary cursor-wait"
            : "btn-primary"
        )}
      >
        {isSearching ? (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-rounded animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
            Searching...
          </span>
        ) : (
          "Search Flights"
        )}
      </button>

      {/* Recent searches */}
      {recentSearches.length > 0 && !isSearching && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-foreground-muted">Recent:</span>
          {recentSearches.slice(0, 5).map((recent, i) => {
            const classLabel = recent.searchClass === "ECON" ? "Econ" : recent.searchClass === "PREM" ? "Biz/First" : "All"
            const rtLabel = recent.tripType === "round_trip" ? " RT" : ""
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleRecentClick(recent)}
                className="text-[11px] px-2 py-0.5 rounded-full bg-card-border/50 text-foreground-muted hover:text-foreground hover:bg-card-border transition-colors"
              >
                {recent.origin} → {recent.destination} · {new Date(recent.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {classLabel}{rtLabel}
              </button>
            )
          })}
        </div>
      )}

      {/* Progress indicators */}
      {isSearching && progress.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          {progress.map((p, i) => (
            <span
              key={i}
              className={cn(
                "text-[11px] px-2 py-0.5 rounded-full font-medium",
                p.status === "complete" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
                p.status === "failed" ? "bg-foreground-muted/10 text-foreground-muted" :
                "bg-blue-100 text-blue-700 dark:bg-primary/10 dark:text-primary"
              )}
            >
              {p.source}: {p.status === "complete" ? `${p.flights} flights` : p.status === "failed" ? "unavailable" : p.status}
            </span>
          ))}
        </div>
      )}
    </form>
  )
}
