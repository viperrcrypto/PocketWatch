/**
 * Impermanent Loss calculator for concentrated and full-range liquidity positions.
 *
 * IL formula (full range): IL = 2 * sqrt(r) / (1 + r) - 1
 *   where r = currentPrice / entryPrice
 *
 * For concentrated liquidity (Uniswap V3), IL is amplified by the concentration factor.
 */

export interface ILResult {
  /** IL as a decimal (e.g., -0.05 = 5% loss) */
  ilPercent: number
  /** USD value lost to IL */
  ilUsd: number
  /** What the position would be worth if held (no LP) */
  holdValue: number
  /** Current LP position value */
  lpValue: number
}

/**
 * Calculate IL for a full-range AMM position.
 */
export function calculateFullRangeIL(
  entryPrice: number,
  currentPrice: number,
  entryValueUsd: number,
): ILResult {
  if (entryPrice <= 0 || currentPrice <= 0 || entryValueUsd <= 0) {
    return { ilPercent: 0, ilUsd: 0, holdValue: entryValueUsd, lpValue: entryValueUsd }
  }

  const r = currentPrice / entryPrice
  const ilFactor = 2 * Math.sqrt(r) / (1 + r) - 1

  // Hold value: half in token0 (stays same in USD), half in token1 (changes with price)
  const holdValue = entryValueUsd * (1 + r) / 2
  const lpValue = holdValue * (1 + ilFactor)

  return {
    ilPercent: ilFactor * 100,
    ilUsd: lpValue - holdValue,
    holdValue,
    lpValue,
  }
}

/**
 * Calculate IL for a concentrated liquidity position (Uniswap V3).
 *
 * Concentrated positions amplify IL proportional to the liquidity concentration.
 * The narrower the range, the higher the effective IL.
 */
export function calculateConcentratedIL(
  entryPrice: number,
  currentPrice: number,
  priceLower: number,
  priceUpper: number,
  currentValueUsd: number,
): ILResult {
  if (entryPrice <= 0 || currentPrice <= 0 || currentValueUsd <= 0) {
    return { ilPercent: 0, ilUsd: 0, holdValue: currentValueUsd, lpValue: currentValueUsd }
  }

  // Clamp current price to range for LP value calculation
  const effectivePrice = Math.max(priceLower, Math.min(priceUpper, currentPrice))

  // Full-range IL
  const r = currentPrice / entryPrice
  const fullRangeIL = 2 * Math.sqrt(r) / (1 + r) - 1

  // Concentration factor: how much narrower than full range
  // Approximation: sqrt(priceUpper/priceLower) gives the range width
  const rangeWidth = Math.sqrt(priceUpper / priceLower)
  const concentrationFactor = rangeWidth > 1 ? rangeWidth / (rangeWidth - 1) : 1

  const concentratedIL = fullRangeIL * concentrationFactor

  // If out of range, all value is in one token — IL is maximized for that direction
  const outOfRange = currentPrice < priceLower || currentPrice > priceUpper

  const denominator = Math.max(1 + concentratedIL, 0.01)
  const holdValue = currentValueUsd / denominator
  const lpValue = currentValueUsd

  return {
    ilPercent: concentratedIL * 100,
    ilUsd: lpValue - holdValue,
    holdValue,
    lpValue,
  }
}

/**
 * Convert Uniswap V3 tick to price.
 * price = 1.0001^tick
 */
export function tickToPrice(tick: number, token0Decimals: number, token1Decimals: number): number {
  const rawPrice = 1.0001 ** tick
  // Adjust for decimal difference
  return rawPrice * (10 ** (token0Decimals - token1Decimals))
}

/**
 * Estimate entry price from the geometric mean of tick range.
 * This is a rough estimate when actual entry data isn't available.
 */
export function estimateEntryPrice(
  tickLower: number,
  tickUpper: number,
  token0Decimals: number,
  token1Decimals: number,
): number {
  const midTick = (tickLower + tickUpper) / 2
  return tickToPrice(midTick, token0Decimals, token1Decimals)
}
