"use client"

import { useMemo } from "react"
import type { HotelItem } from "./result-payload"
import { HotelChatCard } from "./hotel-chat-card"
import { ResultsCarouselShell } from "./results-carousel-shell"
import { BorderBeam } from "@/components/ui/border-beam"

/**
 * Best hotel = highest rating, then cheapest cash per night as a tiebreaker.
 * Spotlighted with the BorderBeam.
 */
function bestHotelIndex(hotels: HotelItem[]): number {
  let best = 0
  for (let i = 1; i < hotels.length; i++) {
    const a = hotels[i]!
    const b = hotels[best]!
    if (a.rating > b.rating) {
      best = i
    } else if (a.rating === b.rating) {
      const aCash = a.cashPerNight ?? Infinity
      const bCash = b.cashPerNight ?? Infinity
      if (aCash < bCash) best = i
    }
  }
  return best
}

/**
 * Paged, swipeable carousel of hotel option cards rendered from a chat tool
 * result. The top-rated option gets an animated accent BorderBeam.
 */
export function HotelResultsCarousel({ hotels }: { hotels: HotelItem[] }) {
  const bestIndex = useMemo(() => bestHotelIndex(hotels), [hotels])
  const cards = useMemo(
    () => hotels.map((h, i) => <HotelChatCard key={i} hotel={h} />),
    [hotels]
  )

  return (
    <div className="my-2">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 16 }}>
          hotel
        </span>
        <span className="label-caps">
          {hotels.length} hotel option{hotels.length > 1 ? "s" : ""}
        </span>
      </div>
      <ResultsCarouselShell
        cards={cards}
        bestIndex={bestIndex}
        label="Hotel options"
        renderBeam={() => <BorderBeam radius={16} duration={6} />}
      />
    </div>
  )
}
