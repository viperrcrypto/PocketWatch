"use client"

import { useState } from "react"
import type { HotelSearchConfig } from "@/types/travel"
import { cn } from "@/lib/utils"
import { DatePicker } from "@/components/ui/date-picker"

interface HotelSearchFormProps {
  onSearch: (config: HotelSearchConfig) => void
  isSearching: boolean
}

export function HotelSearchForm({ onSearch, isSearching }: HotelSearchFormProps) {
  const [query, setQuery] = useState("")
  const [checkIn, setCheckIn] = useState("")
  const [checkOut, setCheckOut] = useState("")
  const [adults, setAdults] = useState(2)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query || !checkIn || !checkOut) return
    onSearch({ query, checkInDate: checkIn, checkOutDate: checkOut, adults })
  }

  const today = new Date().toISOString().split("T")[0]

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>hotel</span>
        <h2 className="text-sm font-bold text-foreground">Search Hotels</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {/* Location */}
        <div className="sm:col-span-1">
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            Location
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, region, or hotel"
            required
            className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* Check-in */}
        <div>
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            Check-in
          </label>
          <DatePicker
            value={checkIn}
            onChange={setCheckIn}
            min={today}
            placeholder="Select date"
            required
          />
        </div>

        {/* Check-out */}
        <div>
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            Check-out
          </label>
          <DatePicker
            value={checkOut}
            onChange={setCheckOut}
            min={checkIn || today}
            placeholder="Select date"
            required
          />
        </div>

        {/* Adults */}
        <div>
          <label className="text-[11px] text-foreground-muted font-medium uppercase tracking-wide mb-1 block">
            Adults
          </label>
          <select
            value={adults}
            onChange={(e) => setAdults(parseInt(e.target.value, 10))}
            className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n} {n === 1 ? "adult" : "adults"}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSearching || !query || !checkIn || !checkOut}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm font-medium transition-colors duration-200",
          isSearching ? "bg-primary/20 text-primary cursor-wait" : "btn-primary",
        )}
      >
        {isSearching ? (
          <span className="flex items-center justify-center gap-2">
            <span className="material-symbols-rounded animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
            Searching...
          </span>
        ) : (
          "Search Hotels"
        )}
      </button>
    </form>
  )
}
