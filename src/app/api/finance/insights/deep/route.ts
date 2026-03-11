import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getCached, setCache } from "@/lib/cache"
import { computeDeepInsights } from "@/lib/finance/deep-insights-engine"
import { NextResponse } from "next/server"

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F8010", "Authentication required", 401)

  try {
    const month = new Date().toISOString().slice(0, 7) // YYYY-MM
    const cacheKey = `deep-insights:${user.id}:${month}`

    const cached = getCached<unknown>(cacheKey)
    if (cached) return NextResponse.json(cached)

    const result = await computeDeepInsights(user.id)
    if (!result) return NextResponse.json({ empty: true })

    setCache(cacheKey, result, CACHE_TTL)
    return NextResponse.json(result)
  } catch (err) {
    return apiError("F8011", "Failed to compute deep insights", 500, err)
  }
}
