import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getCached, setCache } from "@/lib/cache"
import { computeBudgetSuggestions } from "@/lib/finance/budget-suggestions"
import { NextResponse } from "next/server"

const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F9001", "Authentication required", 401)

  try {
    const month = new Date().toISOString().slice(0, 7)
    const cacheKey = `budget-suggest:${user.id}:${month}`

    const cached = getCached<unknown>(cacheKey)
    if (cached) return NextResponse.json(cached)

    const result = await computeBudgetSuggestions(user.id)
    setCache(cacheKey, result, CACHE_TTL)
    return NextResponse.json(result)
  } catch (err) {
    return apiError("F9050", "Failed to compute budget suggestions", 500, err)
  }
}
