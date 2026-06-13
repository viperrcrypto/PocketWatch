"use client"

import type { FlightItem } from "./result-payload"
import { cn } from "@/lib/utils"

/** Extract HH:MM AM/PM from a datetime string. Returns null if no time info. */
function formatTime(dt: string): string | null {
  const match = dt.match(/[\sT](\d{2}):(\d{2})/)
  if (!match) return null
  const h = parseInt(match[1]!)
  const ampm = h >= 12 ? "PM" : "AM"
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${match[2]} ${ampm}`
}

const CPP_COLORS: Record<string, string> = {
  exceptional: "text-emerald-600 dark:text-emerald-400",
  great: "text-blue-600 dark:text-blue-400",
  good: "text-foreground",
  fair: "text-amber-600 dark:text-amber-400",
  poor: "text-foreground-muted",
}

/**
 * Compact flight card for the chat results carousel. Consumes the flat
 * `FlightItem` the flight tool emits. All fields render as React text nodes;
 * the booking link is https-sanitized upstream in result-payload.ts.
 */
export function FlightChatCard({ flight }: { flight: FlightItem }) {
  const isAward = flight.type === "award"
  const depTime = formatTime(flight.departureTime)
  const arrTime = formatTime(flight.arrivalTime)
  const stopsLabel =
    flight.stops === 0 ? "Nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`

  const Inner = (
    <>
      {/* Row 1: airline + badges / price */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-foreground truncate">{flight.airline}</span>
            <span
              className={cn(
                "text-[10px] font-medium uppercase px-1.5 py-0.5 rounded",
                flight.cabin === "first"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                  : flight.cabin === "business"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                    : "bg-card-border/50 text-foreground-muted"
              )}
            >
              {flight.cabin}
            </span>
            {flight.sweetSpot && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                {flight.sweetSpot}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {isAward ? (
            <>
              <p className="text-sm font-bold text-foreground tabular-nums">
                {(flight.points ?? 0).toLocaleString()} pts
              </p>
              {flight.taxes > 0 && (
                <p className="text-[11px] text-foreground-muted">+ ${flight.taxes} taxes</p>
              )}
              {flight.program && (
                <p className="text-[10px] text-foreground-muted">{flight.program}</p>
              )}
            </>
          ) : (
            <p className="text-sm font-bold text-foreground tabular-nums">
              ${flight.cashPrice?.toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: times + route + duration + stops */}
      <div className="flex items-center gap-2 text-xs text-foreground-muted flex-wrap">
        {depTime && arrTime && (
          <>
            <span className="text-foreground font-medium tabular-nums">
              {depTime} – {arrTime}
            </span>
            <span className="text-foreground-muted/40">|</span>
          </>
        )}
        {flight.airports.length > 0 ? (
          <span>{flight.airports.join(" → ")}</span>
        ) : (
          <span>{flight.route}</span>
        )}
        {flight.duration && (
          <>
            <span className="text-foreground-muted/40">•</span>
            <span>{flight.duration}</span>
          </>
        )}
        <span className="text-foreground-muted/40">•</span>
        <span>{stopsLabel}</span>
      </div>

      {/* Row 3: flight numbers */}
      {flight.flightNumbers.length > 0 && (
        <p className="text-[11px] text-foreground-muted mt-0.5">
          {flight.flightNumbers.join(" / ")}
        </p>
      )}

      {/* Row 4: value metrics */}
      {(flight.cppValue != null || flight.valueScore > 0) && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-card-border/50">
          {flight.cppValue != null && (
            <span
              className={cn(
                "text-xs font-bold tabular-nums",
                CPP_COLORS[flight.cppRating ?? ""] ?? "text-foreground"
              )}
            >
              {flight.cppValue}c/pt
            </span>
          )}
          {flight.affordDetails && (
            <span
              className={cn(
                "text-[11px]",
                flight.canAfford
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              )}
            >
              {flight.affordDetails}
            </span>
          )}
          {flight.valueScore > 0 && (
            <span className="ml-auto text-[10px] text-foreground-muted">
              Score {flight.valueScore}/100
            </span>
          )}
        </div>
      )}

      {/* Booking affordance — the whole card is a link, but make it obvious. */}
      {flight.bookingUrl && (
        <div className="flex items-center justify-end gap-1 mt-2 text-[11px] font-semibold text-primary">
          <span>Book</span>
          <span className="material-symbols-rounded" style={{ fontSize: 13 }} aria-hidden="true">
            open_in_new
          </span>
        </div>
      )}
    </>
  )

  if (flight.bookingUrl) {
    return (
      <a
        href={flight.bookingUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="block card p-4 h-full"
      >
        {Inner}
      </a>
    )
  }

  return <div className="card p-4 h-full">{Inner}</div>
}
