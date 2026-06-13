"use client"

import Link from "next/link"
import type { Trip } from "@/hooks/use-trips"
import { STATUS_META, formatTripDates } from "./trip-helpers"
import { destinationCover } from "@/lib/trips/destination-images"

interface TripCardProps {
  trip: Trip
}

export function TripCard({ trip }: TripCardProps) {
  const status = STATUS_META[trip.status]
  const cover = destinationCover(trip.destination)

  return (
    <Link href={`/trips/${trip.id}`} className="card card-interactive overflow-hidden block">
      {/* Destination cover — photo over a deterministic gradient fallback */}
      <div className="relative h-24 w-full" style={{ background: cover.gradient }}>
        {cover.url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover.url}
            alt=""
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => { e.currentTarget.style.display = "none" }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-center gap-1.5">
          <span className="material-symbols-rounded flex-shrink-0 text-white drop-shadow" style={{ fontSize: 16 }} aria-hidden="true">
            {status.icon}
          </span>
          <h3 className="text-sm font-semibold text-white truncate drop-shadow">{trip.name}</h3>
        </div>
      </div>

      {/* Meta */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          {trip.destination && (
            <p className="text-xs text-foreground-muted truncate">{trip.destination}</p>
          )}
          <p className="text-[11px] text-foreground-muted/70 mt-0.5 tabular-nums">
            {formatTripDates(trip.startDate, trip.endDate)}
          </p>
        </div>
        <span className="material-symbols-rounded text-foreground-muted/40 flex-shrink-0" style={{ fontSize: 18 }} aria-hidden="true">
          chevron_right
        </span>
      </div>
    </Link>
  )
}
