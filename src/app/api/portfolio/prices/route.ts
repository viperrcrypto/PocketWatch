import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getServiceKey } from "@/lib/portfolio/service-keys"

const COINGECKO_BASE = "https://api.coingecko.com/api/v3"
const COINGECKO_PRO_BASE = "https://pro-api.coingecko.com/api/v3"

const cache = new Map<string, { data: object; timestamp: number }>()
const CACHE_TTL_MS = 3 * 60_000 // 3 minutes

/**
 * GET /api/portfolio/prices?ids=bitcoin,ethereum,solana
 * Fetches current prices from CoinGecko (with user key if available).
 * Falls back to DeFiLlama free API if no CoinGecko key.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9110", "Authentication required", 401)

  const idsParam = request.nextUrl.searchParams.get("ids") || ""
  const cacheKey = `prices:${idsParam}`

  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(cached.data)
  }

  try {
    const apiKey = await getServiceKey(user.id, "coingecko")

    if (apiKey || idsParam) {
      // Use CoinGecko
      const baseUrl = apiKey ? COINGECKO_PRO_BASE : COINGECKO_BASE
      const headers: Record<string, string> = { Accept: "application/json" }
      if (apiKey) headers["x-cg-pro-api-key"] = apiKey

      const ids = idsParam || "bitcoin,ethereum,solana"
      const url = `${baseUrl}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10_000),
      })

      if (res.ok) {
        const prices = await res.json()
        const result = { assets: prices, source: "coingecko" }
        cache.set(cacheKey, { data: result, timestamp: Date.now() })
        return NextResponse.json(result)
      }
      // Fall through to DeFiLlama on error
    }

    // Fallback: DeFiLlama (free, no key needed)
    const llamaIds = (idsParam || "bitcoin,ethereum,solana")
      .split(",")
      .map((id) => `coingecko:${id.trim()}`)
      .join(",")
    const llamaUrl = `https://coins.llama.fi/prices/current/${encodeURIComponent(llamaIds)}`

    const llamaRes = await fetch(llamaUrl, {
      signal: AbortSignal.timeout(10_000),
    })

    if (!llamaRes.ok) {
      return NextResponse.json({ assets: {} })
    }

    const llamaData = await llamaRes.json()
    // Transform DeFiLlama format to match CoinGecko shape
    const assets: Record<string, { usd: number }> = {}
    for (const [key, val] of Object.entries(llamaData.coins || {})) {
      const id = key.replace("coingecko:", "")
      assets[id] = { usd: (val as { price: number }).price }
    }

    const result = { assets, source: "defillama" }
    cache.set(cacheKey, { data: result, timestamp: Date.now() })
    return NextResponse.json(result)
  } catch (error) {
    return apiError("E9111", "Failed to fetch prices", 500, error)
  }
}
