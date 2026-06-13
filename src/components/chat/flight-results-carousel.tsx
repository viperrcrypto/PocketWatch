"use client"

import { useMemo } from "react"
import type { FlightItem } from "./result-payload"
import { FlightChatCard } from "./flight-chat-card"
import { ResultsCarouselShell } from "./results-carousel-shell"
import { BorderBeam } from "@/components/ui/border-beam"

/** Highest value score wins the BorderBeam spotlight; ties keep the first. */
function bestFlightIndex(flights: FlightItem[]): number {
  let best = 0
  for (let i = 1; i < flights.length; i++) {
    if (flights[i]!.valueScore > flights[best]!.valueScore) best = i
  }
  return best
}

/**
 * Paged, swipeable carousel of flight option cards rendered from a chat tool
 * result. The best-value option gets an animated accent BorderBeam.
 */
export function FlightResultsCarousel({ flights }: { flights: FlightItem[] }) {
  const bestIndex = useMemo(() => bestFlightIndex(flights), [flights])
  const cards = useMemo(
    () => flights.map((f, i) => <FlightChatCard key={i} flight={f} />),
    [flights]
  )

  return (
    <div className="my-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>
          flight
        </span>
        <span className="label-caps">
          {flights.length} flight option{flights.length > 1 ? "s" : ""}
        </span>
      </div>
      <ResultsCarouselShell
        cards={cards}
        bestIndex={bestIndex}
        label="Flight options"
        renderBeam={() => <BorderBeam radius={16} duration={6} />}
      />
    </div>
  )
}
