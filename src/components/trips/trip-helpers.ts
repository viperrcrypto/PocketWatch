import type { Trip, TripStatus, TripSegmentType } from "@/hooks/use-trips"

export const STATUS_META: Record<
  TripStatus,
  { label: string; icon: string; color: string }
> = {
  upcoming: { label: "Upcoming", icon: "schedule", color: "var(--info)" },
  active: { label: "Active", icon: "near_me", color: "var(--success)" },
  past: { label: "Past", icon: "history", color: "var(--foreground-muted)" },
}

export const SEGMENT_META: Record<TripSegmentType, { icon: string }> = {
  flight: { icon: "flight" },
  hotel: { icon: "hotel" },
  car: { icon: "directions_car" },
  activity: { icon: "local_activity" },
}

export interface GroupedTrips {
  upcoming: Trip[]
  active: Trip[]
  past: Trip[]
}

export function groupTrips(trips: Trip[]): GroupedTrips {
  return {
    upcoming: trips.filter((t) => t.status === "upcoming"),
    active: trips.filter((t) => t.status === "active"),
    past: trips.filter((t) => t.status === "past"),
  }
}

export function formatTripDates(startDate: string, endDate: string | null): string {
  const start = formatDate(startDate)
  if (!endDate) return start
  return `${start} – ${formatDate(endDate)}`
}

export function formatDate(iso: string): string {
  // iso is yyyy-mm-dd; parse as local date to avoid TZ shift.
  const [y, m, d] = iso.split("-").map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatSegmentTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
