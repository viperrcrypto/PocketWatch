"use client"

import { useMemo, useState } from "react"
import type { Trip } from "@/hooks/use-trips"
import { SlidingTabIndicator } from "@/components/ui/sliding-tab-indicator"
import { groupTrips } from "./trip-helpers"
import { TripGroup } from "./trip-group"

type TabKey = "upcoming" | "past"

interface TripsTabsProps {
  trips: Trip[]
}

export function TripsTabs({ trips }: TripsTabsProps) {
  const [tab, setTab] = useState<TabKey>("upcoming")

  const grouped = useMemo(() => groupTrips(trips), [trips])
  // Active + upcoming live under the "Upcoming" tab; past under "Past".
  const upcoming = useMemo(
    () => [...grouped.active, ...grouped.upcoming],
    [grouped.active, grouped.upcoming],
  )
  const past = grouped.past

  return (
    <div className="space-y-4">
      <SlidingTabIndicator
        layoutId="trips-tabs"
        ariaLabel="Trips by timeframe"
        active={tab}
        onChange={(id) => setTab(id as TabKey)}
        tabs={[
          { id: "upcoming", label: <TabLabel label="Upcoming" count={upcoming.length} /> },
          { id: "past", label: <TabLabel label="Past" count={past.length} /> },
        ]}
      />

      {tab === "upcoming" ? (
        upcoming.length > 0 ? (
          <TripGroup title="Upcoming" trips={upcoming} />
        ) : (
          <TabEmpty message="No upcoming trips." />
        )
      ) : past.length > 0 ? (
        <TripGroup title="Past" trips={past} />
      ) : (
        <TabEmpty message="No past trips." />
      )}
    </div>
  )
}

function TabLabel({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center">
      {label}
      <span className="ml-1.5 text-[11px] text-foreground-muted/60 tabular-nums">{count}</span>
    </span>
  )
}

function TabEmpty({ message }: { message: string }) {
  return <p className="text-sm text-foreground-muted px-1 py-6">{message}</p>
}
