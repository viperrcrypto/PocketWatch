import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getServiceKey } from "@/lib/portfolio/service-keys"

const COINGECKO_BASE = "https://api.coingecko.com/api/v3"
const COINGECKO_PRO_BASE = "https://pro-api.coingecko.com/api/v3"

const cache = new Map<string, { data: object | null; timestamp: number; is429?: boolean }>()
const CACHE_TTL_MS = 2 * 60_000 // 2 minutes

/**
 * GET /api/coingecko?coinId=bitcoin
 * Returns sparkline data for the CoinGecko widget.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9200", "Authentication required", 401)

  const coinId = request.nextUrl.searchParams.get("coinId") || "bitcoin"

  // Check cache (user-scoped key, with shorter TTL for 429 entries)
  const cacheKey = `${user.id}:${coinId}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < (cached.is429 ? 30_000 : CACHE_TTL_MS)) {
    if (cached.is429) return apiError("E9201", "CoinGecko rate limited, retry later", 429)
    return NextResponse.json(cached.data)
  }

  try {
    const apiKey = await getServiceKey(user.id, "coingecko")

    // Use Pro API if user has a key, otherwise free tier
    const baseUrl = apiKey ? COINGECKO_PRO_BASE : COINGECKO_BASE
    const headers: Record<string, string> = { Accept: "application/json" }
    if (apiKey) {
      headers["x-cg-pro-api-key"] = apiKey
    }

    const url = `${baseUrl}/coins/${encodeURIComponent(coinId)}?localization=false&tickers=false&community_data=false&developer_data=false&sparkline=true`

    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    })

    if (!res.ok) {
      if (res.status === 429) {
        cache.set(cacheKey, { data: null, timestamp: Date.now(), is429: true })
        return apiError("E9201", "CoinGecko rate limit exceeded. Add an API key in Settings for higher limits.", 429)
      }
      throw new Error(`CoinGecko API error: ${res.status}`)
    }

    const coin = await res.json()

    const sparklineData = {
      prices: coin.market_data?.sparkline_7d?.price ?? [],
      current_price: coin.market_data?.current_price?.usd ?? 0,
      price_change_24h: coin.market_data?.price_change_percentage_24h ?? 0,
      name: coin.name ?? coinId,
      symbol: (coin.symbol ?? coinId).toUpperCase(),
    }

    cache.set(cacheKey, { data: sparklineData, timestamp: Date.now() })
    return NextResponse.json(sparklineData)
  } catch (error) {
    return apiError("E9202", "Failed to fetch CoinGecko data", 500, error)
  }
}
