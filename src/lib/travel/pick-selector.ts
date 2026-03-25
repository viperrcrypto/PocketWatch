/**
 * PocketWatch Picks — selects the best flights across different optimization axes.
 * Pure function, no side effects. Runs client-side on already-scored flights.
 */

import type { ValueScoredFlight, PickCandidate, PickCategory } from "@/types/travel"

// ─── Category Metadata ──────────────────────────────────────────

interface PickMeta {
  label: string
  icon: string
  accent: string
  metric: (f: ValueScoredFlight) => string
}

export const PICK_CATEGORY_META: Record<PickCategory, PickMeta> = {
  "pocketwatch-pick": {
    label: "Top Pick",
    icon: "star",
    accent: "#818cf8",
    metric: (f) => `${f.valueScore}/100`,
  },
  "best-value": {
    label: "Best Value",
    icon: "trending_up",
    accent: "#6ee7b7",
    metric: (f) => f.realCpp ? `${f.realCpp}c/pt` : "",
  },
  quickest: {
    label: "Quickest",
    icon: "bolt",
    accent: "#fcd34d",
    metric: (f) => formatDuration(f.durationMinutes),
  },
  nonstop: {
    label: "Nonstop",
    icon: "flight_takeoff",
    accent: "#93c5fd",
    metric: () => "Direct",
  },
  "sweet-spot": {
    label: "Sweet Spot",
    icon: "target",
    accent: "#c4b5fd",
    metric: (f) => f.sweetSpotMatch?.label ?? "Matched",
  },
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return `${h}h${m > 0 ? `${m}m` : ""}`
}

// ─── Pick Selection ─────────────────────────────────────────────

export function selectPicks(flights: ReadonlyArray<ValueScoredFlight>): PickCandidate[] {
  // Only consider outbound / one-way flights (skip return legs)
  const candidates = flights.filter((f) => f.leg !== "return")
  const usedIds = new Set<string>()
  const picks: PickCandidate[] = []

  function addPick(category: PickCategory, flight: ValueScoredFlight | undefined) {
    if (!flight || usedIds.has(flight.id)) return
    picks.push({ category, flight })
    usedIds.add(flight.id)
  }

  // Prefer affordable flights, but fall back to any award if none are affordable
  const hasAffordable = candidates.some((f) => f.type === "award" && f.canAfford)

  // 1. PocketWatch Pick — best overall award (prefer affordable)
  const pocketwatchPick = [...candidates]
    .filter((f) => f.type === "award" && f.valueScore > 0 && (!hasAffordable || f.canAfford))
    .sort((a, b) => b.valueScore - a.valueScore)[0]

  addPick("pocketwatch-pick", pocketwatchPick)

  // 2. Best Value — highest CPP (skipped if same as PocketWatch Pick via usedIds)
  const bestValue = [...candidates]
    .filter((f) => f.type === "award" && f.realCpp != null && f.realCpp > 0 && !usedIds.has(f.id) && (!hasAffordable || f.canAfford))
    .sort((a, b) => (b.realCpp ?? 0) - (a.realCpp ?? 0))[0]

  addPick("best-value", bestValue)

  // 3. Quickest — shortest duration with reasonable value, must be meaningfully faster than the Pick
  if (pocketwatchPick) {
    const quickest = [...candidates]
      .filter((f) => f.type === "award" && f.valueScore > 30 && !usedIds.has(f.id))
      .sort((a, b) => a.durationMinutes - b.durationMinutes)[0]

    if (quickest && quickest.durationMinutes <= pocketwatchPick.durationMinutes - 30) {
      addPick("quickest", quickest)
    }
  }

  // 4. Nonstop — best nonstop option
  const nonstop = [...candidates]
    .filter((f) => f.stops === 0 && f.type === "award" && !usedIds.has(f.id))
    .sort((a, b) => b.valueScore - a.valueScore)[0]

  addPick("nonstop", nonstop)

  // 5. Sweet Spot — best sweet spot match
  const sweetSpot = [...candidates]
    .filter((f) => f.sweetSpotMatch != null && !usedIds.has(f.id))
    .sort((a, b) => (b.sweetSpotMatch?.matchScore ?? 0) - (a.sweetSpotMatch?.matchScore ?? 0))[0]

  addPick("sweet-spot", sweetSpot)

  return picks
}
