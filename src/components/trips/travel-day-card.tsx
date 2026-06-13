"use client"

import { useTripBriefing } from "@/hooks/use-trip-briefing"
import { formatSegmentTime } from "./trip-helpers"

interface TravelDayCardProps {
  tripId: string
}

export function TravelDayCard({ tripId }: TravelDayCardProps) {
  const { data, isLoading, isError } = useTripBriefing(tripId)

  if (isLoading) {
    return <div className="card p-4 h-40 animate-pulse" />
  }

  if (isError || !data) {
    return (
      <div className="card p-4">
        <CardHeader />
        <p className="text-xs text-foreground-muted mt-2">
          Travel-day briefing is unavailable right now.
        </p>
      </div>
    )
  }

  const { weather, nextFlight, tips } = data

  return (
    <div className="card p-4 space-y-3">
      <CardHeader />

      {weather ? (
        <div>
          <p className="text-2xl font-data font-black tabular-nums text-foreground" style={{ letterSpacing: "-0.02em" }}>
            {weather.tempF}°F
          </p>
          <p className="text-xs text-foreground-muted mt-0.5">{weather.condition}</p>
          <div className="flex items-center gap-3 text-[11px] text-foreground-muted/80 mt-2 tabular-nums">
            <span>H {weather.forecastHigh}°</span>
            <span>L {weather.forecastLow}°</span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-rounded" style={{ fontSize: 13 }} aria-hidden="true">
                water_drop
              </span>
              {weather.chanceOfRain}%
            </span>
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-foreground-muted/70 leading-relaxed">
          Add <code className="font-mono">WEATHERAPI_KEY</code> to enable weather.
        </p>
      )}

      {nextFlight && (
        <div className="pt-3 border-t border-card-border">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 15 }} aria-hidden="true">
              flight
            </span>
            <span className="text-[11px] font-medium text-foreground-muted uppercase tracking-wide">
              Next flight
            </span>
          </div>
          <p className="text-sm font-medium text-foreground truncate">{nextFlight.title}</p>
          <div className="flex items-center gap-2 text-[11px] text-foreground-muted mt-0.5 tabular-nums">
            <span>{formatSegmentTime(nextFlight.startAt)}</span>
            {nextFlight.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate">{nextFlight.location}</span>
              </>
            )}
          </div>
        </div>
      )}

      {tips.length > 0 && (
        <ul className="pt-3 border-t border-card-border space-y-1.5">
          {tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-[11px] text-foreground-muted leading-relaxed">
              <span className="material-symbols-rounded text-foreground-muted/50 flex-shrink-0 mt-0.5" style={{ fontSize: 14 }} aria-hidden="true">
                lightbulb
              </span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CardHeader() {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-bold text-foreground">Travel Day</h3>
      <span
        className="material-symbols-rounded text-foreground-muted/40"
        style={{ fontSize: 18 }}
        aria-hidden="true"
      >
        partly_cloudy_day
      </span>
    </div>
  )
}
