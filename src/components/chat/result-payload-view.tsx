"use client"

import type { ResultPayload } from "./result-payload"
import { FlightResultsCarousel } from "./flight-results-carousel"
import { HotelResultsCarousel } from "./hotel-results-carousel"
import { HoldingsCard } from "./holdings-card"
import { BudgetsCard } from "./budgets-card"

/** Render a parsed structured payload as the matching rich card. */
export function ResultPayloadView({ payload }: { payload: ResultPayload }) {
  if (payload.kind === "flights") {
    return <FlightResultsCarousel flights={payload.items} />
  }
  if (payload.kind === "hotels") {
    return <HotelResultsCarousel hotels={payload.items} />
  }
  if (payload.kind === "holdings") {
    return (
      <HoldingsCard
        holdings={payload.items}
        totalValue={payload.totalValue}
        onchainTotalValue={payload.onchainTotalValue}
        exchangeTotalValue={payload.exchangeTotalValue}
        shown={payload.shown}
        totalPositions={payload.totalPositions}
      />
    )
  }
  return <BudgetsCard budgets={payload.items} created={payload.created} updated={payload.updated} />
}
