"use client"

import type { Trip } from "@/hooks/use-trips"
import { TripCard } from "./trip-card"

interface TripGroupProps {
  title: string
  trips: Trip[]
}

export function TripGroup({ title, trips }: TripGroupProps) {
  if (trips.length === 0) return null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          {title}
        </h2>
        <span className="text-[11px] text-foreground-muted/50 tabular-nums">{trips.length}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {trips.map((trip) => (
          <TripCard key={trip.id} trip={trip} />
        ))}
      </div>
    </section>
  )
}
