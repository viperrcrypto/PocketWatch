"use client"

import type { ValueScoredFlight } from "@/types/travel"
import { cn } from "@/lib/utils"
import { SweetSpotBadge } from "./sweet-spot-badge"
import { PROGRAM_DISPLAY_NAMES } from "@/lib/travel/constants"

interface FlightResultCardProps {
  flight: ValueScoredFlight
}

const cppRatingColors: Record<string, string> = {
  exceptional: "text-emerald-400",
  great: "text-blue-400",
  good: "text-foreground",
  fair: "text-amber-400",
  poor: "text-foreground-muted",
}

function formatDuration(mins: number): string {
  if (mins <= 0) return ""
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? `${m}m` : ""}`
}

/** Extract HH:MM AM/PM from a datetime string. Returns null if no time info. */
function formatTime(dt: string | undefined): string | null {
  if (!dt) return null
  // Match "T" or space before time: "2026-05-08T13:02" or "2026-05-08 13:02"
  const match = dt.match(/[\sT](\d{2}):(\d{2})/)
  if (!match) return null
  const h = parseInt(match[1]!)
  const m = match[2]!
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${ampm}`
}

/** Format travel date as "May 5" or "May 5, Tue" */
function formatDate(dateStr: string | undefined): string | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return null
  const d = new Date(dateStr.slice(0, 10) + "T12:00:00")
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })
}

/** Check if arrival is next day relative to departure */
function isNextDay(dep: string | undefined, arr: string | undefined): boolean {
  if (!dep || !arr) return false
  const depDate = dep.slice(0, 10)
  const arrDate = arr.slice(0, 10)
  if (depDate.length !== 10 || arrDate.length !== 10) return false
  return arrDate > depDate
}

export function FlightResultCard({ flight }: FlightResultCardProps) {
  const isAward = flight.type === "award"
  const programName = flight.pointsProgram
    ? PROGRAM_DISPLAY_NAMES[flight.pointsProgram] || flight.pointsProgram
    : null

  const depTime = formatTime(flight.departureTime)
  const arrTime = formatTime(flight.arrivalTime)
  const hasTimes = depTime && arrTime
  const nextDay = isNextDay(flight.departureTime, flight.arrivalTime)
  const dateLabel = formatDate(flight.travelDate || flight.departureTime)
  const duration = formatDuration(flight.durationMinutes)
  const stopsLabel = flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`

  return (
    <a
      href={flight.bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block card p-4 hover:translate-y-[-1px] hover:shadow-md transition-all duration-200"
    >
      {/* Row 1: Airline + badges left, price right */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{flight.airline}</span>
            <span className={cn(
              "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
              flight.cabinClass === "first" ? "bg-amber-500/10 text-amber-400" :
              flight.cabinClass === "business" ? "bg-blue-500/10 text-blue-400" :
              "bg-card-border/50 text-foreground-muted"
            )}>
              {flight.cabinClass}
            </span>
            {flight.searchOrigin && flight.searchDestination && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-card-border/50 text-foreground-muted">
                {flight.searchOrigin}-{flight.searchDestination}
              </span>
            )}
            {dateLabel && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-card-border/50 text-foreground-muted">
                {dateLabel}
              </span>
            )}
            {flight.sweetSpotMatch && <SweetSpotBadge match={flight.sweetSpotMatch} />}
          </div>
        </div>

        {/* Price / Points */}
        <div className="text-right flex-shrink-0">
          {isAward ? (
            <>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {(flight.points || 0).toLocaleString()} pts
              </p>
              {flight.taxes > 0 && (
                <p className="text-[11px] text-foreground-muted">+ ${flight.taxes} taxes</p>
              )}
              {programName && (
                <p className="text-[10px] text-foreground-muted/70">{programName}</p>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-foreground tabular-nums">
              ${flight.cashPrice?.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Times + route + duration */}
      <div className="flex items-center gap-3 text-xs text-foreground-muted">
        {hasTimes ? (
          <>
            <span className="text-foreground font-medium tabular-nums">
              {depTime} – {arrTime}{nextDay && <sup className="text-[9px] text-foreground-muted ml-0.5">+1</sup>}
            </span>
            <span className="text-foreground-muted/40">|</span>
          </>
        ) : null}
        <span>{flight.airports.join(" → ")}</span>
        {duration && (
          <>
            <span className="text-foreground-muted/40">•</span>
            <span>{duration}</span>
          </>
        )}
        <span className="text-foreground-muted/40">•</span>
        <span>{stopsLabel}</span>
        {flight.availableSeats && flight.availableSeats > 0 && (
          <>
            <span className="text-foreground-muted/40">•</span>
            <span className={cn(
              "text-[11px]",
              flight.availableSeats <= 3 ? "text-amber-400" : "text-foreground-muted"
            )}>
              {flight.availableSeats <= 9 ? `${flight.availableSeats} seats` : "9+ seats"}
            </span>
          </>
        )}
      </div>

      {/* Row 3: Flight numbers + equipment */}
      {flight.flightNumbers.length > 0 && (
        <p className="text-[11px] text-foreground-muted/70 mt-0.5">
          {flight.flightNumbers.join(" / ")}
          {flight.equipment.length > 0 && ` · ${flight.equipment.join(", ")}`}
        </p>
      )}

      {/* Value metrics for award flights */}
      {isAward && flight.realCpp !== null && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-card-border/50">
          <span className={cn("text-xs font-bold tabular-nums", cppRatingColors[flight.cppRating || ""])}>
            {flight.realCpp}c/pt
          </span>
          {flight.cashComparable && (
            <span className="text-[11px] text-foreground-muted">
              vs ${flight.cashComparable.toLocaleString()} cash
              {flight.cashSource === "exact-match" ? " (exact)" : flight.cashSource === "same-cabin" ? " (avg)" : ""}
            </span>
          )}
          <span className="ml-auto text-[10px] text-foreground-muted/70">
            Score: {flight.valueScore}/100
          </span>
        </div>
      )}

      {/* Funding path */}
      {isAward && flight.fundingPath && (
        <div className="mt-1.5">
          <p className={cn(
            "text-[11px]",
            flight.canAfford ? "text-emerald-400" : "text-amber-400"
          )}>
            {flight.affordDetails}
          </p>
        </div>
      )}
    </a>
  )
}
