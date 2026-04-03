"use client"

import type { ValueScoredFlight } from "@/types/travel"
import { cn } from "@/lib/utils"
import { SweetSpotBadge } from "./sweet-spot-badge"
import { PROGRAM_DISPLAY_NAMES } from "@/lib/travel/constants"
import { formatDuration } from "@/lib/travel/pick-selector"
import { analyzeFareFlexibility, extractAirlineCode } from "@/lib/travel/fare-flexibility"
import { estimateAirlineFees, extractFirstIATA } from "@/lib/travel/airline-fees"

interface FlightResultCardProps {
  flight: ValueScoredFlight
}

const SOURCE_COLORS: Record<string, string> = {
  roame: "bg-purple-100 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
  pointme: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  google: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  atf: "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  "hidden-city": "bg-pink-100 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400",
}

const SOURCE_LABELS: Record<string, string> = {
  roame: "Roame",
  pointme: "point.me",
  google: "Google",
  atf: "ATF",
  "hidden-city": "Hidden City",
}

const cppRatingColors: Record<string, string> = {
  exceptional: "text-emerald-600 dark:text-emerald-400",
  great: "text-blue-600 dark:text-blue-400",
  good: "text-foreground",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-foreground-muted",
}

/** Extract HH:MM AM/PM from a datetime string. Returns null if no time info. */
function formatTime(dt: string | undefined): string | null {
  if (!dt) return null
  const match = dt.match(/[\sT](\d{2}):(\d{2})/)
  if (!match) return null
  const h = parseInt(match[1]!)
  const m = match[2]!
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m} ${ampm}`
}

/** Format travel date as "May 5, Tue" */
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

  const flexibility = analyzeFareFlexibility(flight.fareClass, extractAirlineCode(flight.airline))
  const iata = extractFirstIATA(flight.operatingAirlines, flight.airline)
  const fees = flight.type === "cash" ? estimateAirlineFees(iata) : null

  const depTime = formatTime(flight.departureTime)
  const arrTime = formatTime(flight.arrivalTime)
  const hasTimes = depTime && arrTime
  const nextDay = isNextDay(flight.departureTime, flight.arrivalTime)
  const dateLabel = formatDate(flight.travelDate || flight.departureTime)
  const duration = formatDuration(flight.durationMinutes)
  const stopsLabel = flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`

  return (
    <a
      id={`flight-${flight.id}`}
      href={flight.bookingUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block card p-4 hover:translate-y-[-1px] hover:shadow-md transition-colors duration-200"
    >
      {/* Row 1: Airline + badges left, price right */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{flight.airline}</span>
            <span className={cn(
              "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
              flight.cabinClass === "first" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
              flight.cabinClass === "business" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
              "bg-card-border/50 text-foreground-muted"
            )}>
              {flight.cabinClass}
            </span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              SOURCE_COLORS[flight.source] || "bg-card-border/50 text-foreground-muted"
            )}>
              {SOURCE_LABELS[flight.source] || flight.source}
            </span>
            {flight.sources && flight.sources.length > 1 && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-card-border/30 text-foreground-muted">
                {flight.sources.length} sources
              </span>
            )}
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
                <p className="text-[10px] text-foreground-muted">{programName}</p>
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
              flight.availableSeats <= 3 ? "text-amber-600 dark:text-amber-400" : "text-foreground-muted"
            )}>
              {flight.availableSeats <= 9 ? `${flight.availableSeats} seats` : "9+ seats"}
            </span>
          </>
        )}
      </div>

      {/* Row 3: Flight numbers + equipment */}
      {flight.flightNumbers.length > 0 && (
        <p className="text-[11px] text-foreground-muted mt-0.5">
          {flight.flightNumbers.join(" / ")}
          {flight.equipment.length > 0 && ` · ${flight.equipment.join(", ")}`}
        </p>
      )}

      {/* Row 4: Flexibility + fees */}
      {(flexibility || (fees && fees.total > 0)) && (
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {flexibility && (
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              flexibility.level === "flexible" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" :
              flexibility.level === "semi-flexible" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400" :
              flexibility.level === "restricted" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400" :
              "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400"
            )} title={flexibility.description}>
              {flexibility.shortLabel}
            </span>
          )}
          {fees && fees.total > 0 && (
            <span className="text-[10px] text-foreground-muted" title={[
              fees.checkedBag ? `Checked bag: $${fees.checkedBag}` : null,
              fees.carryOn ? `Carry-on: $${fees.carryOn}` : null,
              fees.seatSelection ? `Seat: $${fees.seatSelection}` : null,
            ].filter(Boolean).join(", ")}>
              est. +${fees.total} fees
            </span>
          )}
        </div>
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
          <span className="ml-auto text-[10px] text-foreground-muted">
            Score: {flight.valueScore}/100
          </span>
        </div>
      )}

      {/* Funding path */}
      {isAward && flight.fundingPath && (
        <div className="mt-1.5">
          <p className={cn(
            "text-[11px]",
            flight.canAfford ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
          )}>
            {flight.affordDetails}
          </p>
        </div>
      )}
    </a>
  )
}
