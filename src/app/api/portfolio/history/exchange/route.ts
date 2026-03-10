import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import {
  parseExchangeFilters,
  buildExchangeHistoryResponse,
  refreshExchangeCache,
} from "@/lib/portfolio/exchange-history"

export const maxDuration = 60

/** GET /api/portfolio/history/exchange — read persisted exchange history from DB cache */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9070", "Authentication required", 401)

  try {
    const filters = parseExchangeFilters(request.nextUrl.searchParams)
    const data = await buildExchangeHistoryResponse(user.id, filters)
    return NextResponse.json({ ...data, meta: { fromCache: true } })
  } catch (error) {
    return apiError("E9071", "Failed to fetch exchange transactions", 500, error)
  }
}

/** POST /api/portfolio/history/exchange — refresh exchange cache from providers */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9072", "Authentication required", 401)

  try {
    const body = await request.json().catch(() => ({}))
    const targetExchangeId = typeof body?.exchangeId === "string" ? body.exchangeId : undefined

    const refresh = await refreshExchangeCache(user.id, targetExchangeId)
    const data = await buildExchangeHistoryResponse(user.id, {
      offset: 0,
      limit: 200,
      ...(targetExchangeId ? { exchangeId: targetExchangeId } : {}),
    })

    return NextResponse.json({
      ...data,
      meta: {
        fromCache: false,
        refreshed: true,
        inserted: refresh.inserted,
        refreshedExchanges: refresh.refreshedExchanges,
        exchangeDiagnostics: refresh.diagnostics,
      },
    })
  } catch (error) {
    return apiError("E9073", "Failed to refresh exchange transactions", 500, error)
  }
}
