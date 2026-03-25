/**
 * Helpers for multi-airport and flex-date search expansion.
 */

import type { UnifiedFlightResult, PointsBalance } from "@/types/travel"

/** Expand a single date into [date-1, date, date+1] for flex-date search. */
export function expandFlexDates(date: string): string[] {
  const d = new Date(date + "T12:00:00Z")
  const prev = new Date(d); prev.setUTCDate(d.getUTCDate() - 1)
  const next = new Date(d); next.setUTCDate(d.getUTCDate() + 1)
  const fmt = (dt: Date) => dt.toISOString().split("T")[0]!
  return [fmt(prev), date, fmt(next)]
}

/** Tag flight results with the specific origin/dest/date combo they came from. */
export function tagResults(
  flights: ReadonlyArray<UnifiedFlightResult>,
  origin: string,
  destination: string,
  date: string,
  leg?: "outbound" | "return",
): UnifiedFlightResult[] {
  return flights.map((f) => ({
    ...f,
    searchOrigin: origin,
    searchDestination: destination,
    searchDate: date,
    ...(leg ? { leg } : {}),
  }))
}

/** Generate user-facing warnings based on points balances. */
export function generateWarnings(balances: PointsBalance[]): string[] {
  const warnings: string[] = []
  const alaska = balances.find(b => b.programKey === "ALASKA")
  if (alaska && alaska.balance < 100000) {
    warnings.push(`Alaska only has ${alaska.balance.toLocaleString()} — enough for ~1 business OW or 1 economy RT`)
  }
  return warnings
}
