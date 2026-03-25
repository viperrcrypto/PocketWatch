"use client"

import { useMemo, useEffect, useState } from "react"
import type { ValueScoredFlight, PickCandidate } from "@/types/travel"
import { selectPicks, PICK_CATEGORY_META, formatDuration } from "@/lib/travel/pick-selector"
import { PROGRAM_DISPLAY_NAMES } from "@/lib/travel/constants"
import { cn } from "@/lib/utils"

// ─── Main Component ─────────────────────────────────────────────

interface PocketWatchPicksProps {
  flights: ValueScoredFlight[]
  isMultiSearch: boolean
  onPickClick?: (flightId: string) => void
}

export function PocketWatchPicks({ flights, isMultiSearch, onPickClick }: PocketWatchPicksProps) {
  const picks = useMemo(() => selectPicks(flights), [flights])

  if (picks.length === 0) return null

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>
          auto_awesome
        </span>
        <h2 className="text-sm font-bold text-foreground">PocketWatch Picks</h2>
        <span className="text-[11px] text-foreground-muted">
          {picks.length} of {flights.length}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {picks.map((pick) => (
          <PickCard
            key={pick.category}
            pick={pick}
            isMultiSearch={isMultiSearch}
            onPickClick={onPickClick}
          />
        ))}
      </div>
    </section>
  )
}

// ─── Pick Card ──────────────────────────────────────────────────

interface PickCardProps {
  pick: PickCandidate
  isMultiSearch: boolean
  onPickClick?: (flightId: string) => void
}

function useIsDark() {
  const [dark, setDark] = useState(false)
  useEffect(() => {
    const check = () => setDark(document.documentElement.getAttribute("data-theme") === "dark")
    check()
    const obs = new MutationObserver(check)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] })
    return () => obs.disconnect()
  }, [])
  return dark
}

function PickCard({ pick, isMultiSearch, onPickClick }: PickCardProps) {
  const { flight } = pick
  const meta = PICK_CATEGORY_META[pick.category]
  const isDark = useIsDark()
  const accent = isDark ? meta.accentDark : meta.accentLight
  const programName = flight.pointsProgram
    ? PROGRAM_DISPLAY_NAMES[flight.pointsProgram] || flight.pointsProgram
    : null

  const handleClick = () => {
    if (onPickClick) {
      onPickClick(flight.id)
    } else {
      window.open(flight.bookingUrl, "_blank", "noopener,noreferrer")
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex-shrink-0 w-[240px] snap-start card p-3 text-left overflow-hidden",
        "hover:translate-y-[-1px] hover:shadow-md transition-all duration-200 cursor-pointer",
      )}
      style={{ borderLeft: `2px solid ${accent}` }}
    >
      {/* Category label + key metric */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="material-symbols-rounded flex-shrink-0"
            style={{ fontSize: 13, color: accent }}
          >
            {meta.icon}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide truncate text-foreground-muted">
            {meta.label}
          </span>
        </div>
        <span className="text-[11px] font-bold tabular-nums flex-shrink-0 ml-2 text-foreground">
          {meta.metric(flight)}
        </span>
      </div>

      {/* Airline + cabin */}
      <p className="text-xs font-bold text-foreground truncate">
        {flight.airline}
        <span className={cn(
          "font-normal ml-1.5 uppercase text-[10px]",
          flight.cabinClass === "first" ? "text-amber-700 dark:text-amber-400/70" :
          flight.cabinClass === "business" ? "text-blue-700 dark:text-blue-400/70" :
          "text-foreground-muted",
        )}>
          {flight.cabinClass}
        </span>
      </p>

      {/* Route */}
      <p className="text-[11px] text-foreground-muted mt-1 truncate">
        {flight.airports.join(" → ")}
      </p>

      {/* Duration + stops */}
      <div className="flex items-center gap-2 mt-0.5 text-[11px]">
        <span className="font-medium text-foreground tabular-nums">
          {formatDuration(flight.durationMinutes)}
        </span>
        <span className="text-foreground-muted">
          {flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Multi-search route tag */}
      {isMultiSearch && flight.searchOrigin && flight.searchDestination && (
        <span className="text-[9px] font-mono px-1 py-0.5 mt-0.5 block w-fit rounded bg-card-border/30 text-foreground-muted/70">
          {flight.searchOrigin}→{flight.searchDestination}
        </span>
      )}

      {/* Price */}
      <div className="mt-2 pt-2 border-t border-card-border/50">
        {flight.type === "award" ? (
          <>
            <p className="text-xs font-bold text-foreground tabular-nums">
              {(flight.points ?? 0).toLocaleString()} pts
              {flight.taxes > 0 && (
                <span className="font-normal text-foreground-muted"> + ${flight.taxes}</span>
              )}
            </p>
            {programName && (
              <p className="text-[10px] text-foreground-muted/70 truncate">{programName}</p>
            )}
          </>
        ) : (
          <p className="text-xs font-bold text-foreground tabular-nums">
            ${flight.cashPrice?.toLocaleString()}
          </p>
        )}
      </div>
    </button>
  )
}
