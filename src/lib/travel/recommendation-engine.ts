/**
 * Recommendation engine — picks the best value award, best premium product,
 * and best cash option from scored flights for the dashboard "picks" rail.
 */

import type { PointsBalance, Recommendation, ValueScoredFlight } from "@/types/travel"

export function generateRecommendations(
  flights: ValueScoredFlight[],
  _balances: PointsBalance[],
): Recommendation[] {
  const recommendations: Recommendation[] = []

  // #1: Best value award
  const bestValueAwards = flights
    .filter(f => f.type === "award" && f.realCpp !== null && f.realCpp > 0 && f.canAfford)
    .sort((a, b) => (b.realCpp || 0) - (a.realCpp || 0))

  if (bestValueAwards.length > 0) {
    const best = bestValueAwards[0]!
    const cppLabel = best.cashSource === "exact-match" ? "(vs actual cash)" :
                     best.cashSource === "same-cabin" ? "(vs avg cash)" : "(est.)"
    const sweetSpotTag = best.sweetSpotMatch ? " SWEET SPOT" : ""

    recommendations.push({
      rank: 1,
      title: `${best.pointsProgram} → ${best.airline}${sweetSpotTag}`,
      subtitle: `${best.cabinClass} class via ${best.airports.join("→")}`,
      details: [
        `${best.flightNumbers.join(" / ")}`,
        `${Math.floor(best.durationMinutes / 60)}h${best.durationMinutes % 60}m, ${best.stops} stop${best.stops !== 1 ? "s" : ""}`,
        `Cash comparable: $${best.cashComparable?.toLocaleString()} ${cppLabel}`,
        best.affordDetails,
        ...(best.sweetSpotMatch ? [best.sweetSpotMatch.spot.description.slice(0, 80)] : []),
      ],
      totalCost: `${(best.points || 0).toLocaleString()} pts + $${best.taxes}`,
      cppValue: `${best.realCpp}c/pt`,
      bookingUrl: best.bookingUrl,
      badgeText: "#1 BEST VALUE",
      badgeColor: "emerald",
    })
  }

  // #2: Best product (premium cabin + high value score)
  const alreadyUsed = bestValueAwards[0]?.id
  const bestPremium = flights
    .filter(f =>
      f.type === "award" &&
      (f.cabinClass === "business" || f.cabinClass === "first") &&
      f.canAfford &&
      f.id !== alreadyUsed
    )
    .sort((a, b) => b.valueScore - a.valueScore)[0]

  if (bestPremium) {
    recommendations.push({
      rank: 2,
      title: `${bestPremium.pointsProgram} → ${bestPremium.airline}`,
      subtitle: `${bestPremium.cabinClass} class • ${bestPremium.airports.join("→")}`,
      details: [
        bestPremium.flightNumbers.join(" / "),
        `Value Score: ${bestPremium.valueScore}/100`,
        bestPremium.realCpp ? `${bestPremium.realCpp}c/pt vs $${bestPremium.cashComparable?.toLocaleString()} cash` : "",
        `${Math.floor(bestPremium.durationMinutes / 60)}h${bestPremium.durationMinutes % 60}m`,
      ].filter(Boolean),
      totalCost: `${(bestPremium.points || 0).toLocaleString()} pts + $${bestPremium.taxes}`,
      cppValue: bestPremium.realCpp ? `${bestPremium.realCpp}c/pt` : null,
      bookingUrl: bestPremium.bookingUrl,
      badgeText: "#2 BEST PRODUCT",
      badgeColor: "accent",
    })
  }

  // #3: Cash option
  const cheapestCash = flights
    .filter(f => f.type === "cash" && f.cashPrice && f.cashPrice > 0)
    .sort((a, b) => (a.cashPrice || Infinity) - (b.cashPrice || Infinity))[0]

  if (cheapestCash) {
    const bestAwardCpp = bestValueAwards[0]?.realCpp ?? null
    const cashWins = bestAwardCpp === null || bestAwardCpp < 1.0
    const borderline = bestAwardCpp !== null && bestAwardCpp >= 1.0 && bestAwardCpp < 1.5

    const cppDetail = bestAwardCpp === null
      ? "No award redemptions available — cash is your best option"
      : cashWins
        ? `Cash wins — best award is only ${bestAwardCpp}c/pt, save points for a better route`
        : borderline
          ? `Awards get ${bestAwardCpp}c/pt — borderline value. Cash at $${cheapestCash.cashPrice?.toLocaleString()} is comparable`
          : `Points get ${bestAwardCpp}c/pt value here — use them`

    recommendations.push({
      rank: 3,
      title: `Cash ${cheapestCash.cabinClass} at $${cheapestCash.cashPrice?.toLocaleString()}`,
      subtitle: `${cheapestCash.airline} • ${cheapestCash.stops === 0 ? "Nonstop" : `${cheapestCash.stops} stop`}`,
      details: [
        cheapestCash.flightNumbers.join(" / "),
        cppDetail,
      ],
      totalCost: `$${cheapestCash.cashPrice?.toLocaleString()}`,
      cppValue: null,
      bookingUrl: cheapestCash.bookingUrl,
      badgeText: cashWins ? "#3 CASH WINS" : borderline ? "#3 CONSIDER CASH" : "#3 USE POINTS",
      badgeColor: "gold",
    })
  }

  return recommendations
}
