import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { normalizeSource, buildUnifiedHistoryResponse } from "@/lib/portfolio/event-history"

export const maxDuration = 60

/** GET /api/portfolio/history/events */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9095", "Authentication required", 401)

  const sp = request.nextUrl.searchParams
  const params = {
    offset: Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0),
    limit: Math.min(5000, Math.max(1, parseInt(sp.get("limit") ?? "25", 10) || 25)),
    event_type: sp.get("event_type") || undefined,
    classification: sp.get("classification") || undefined,
    source: normalizeSource(sp.get("source")),
    exchangeId: sp.get("exchangeId") || undefined,
    asset: sp.get("asset") || undefined,
    search: sp.get("search") || undefined,
    from_timestamp: sp.has("from_timestamp") ? parseInt(sp.get("from_timestamp") ?? "0", 10) : undefined,
    to_timestamp: sp.has("to_timestamp") ? parseInt(sp.get("to_timestamp") ?? "0", 10) : undefined,
    wallet_address: sp.get("wallet_address") || undefined,
  }

  try {
    const data = await buildUnifiedHistoryResponse(user.id, params)
    return NextResponse.json(data)
  } catch (error) {
    return apiError("E9096", "Failed to fetch transaction history", 500, error)
  }
}

/** POST /api/portfolio/history/events — kept for backward compatibility */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9097", "Authentication required", 401)

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>

    const data = await buildUnifiedHistoryResponse(user.id, {
      offset: Math.max(0, Number(body.offset ?? 0) || 0),
      limit: Math.min(5000, Math.max(1, Number(body.limit ?? 25) || 25)),
      event_type: typeof body.event_type === "string" ? body.event_type : undefined,
      classification: typeof body.classification === "string" ? body.classification : undefined,
      source: normalizeSource(typeof body.source === "string" ? body.source : null),
      exchangeId: typeof body.exchangeId === "string" ? body.exchangeId : undefined,
      asset: typeof body.asset === "string" ? body.asset : undefined,
      search: typeof body.search === "string" ? body.search : undefined,
      from_timestamp: typeof body.from_timestamp === "number" ? body.from_timestamp : undefined,
      to_timestamp: typeof body.to_timestamp === "number" ? body.to_timestamp : undefined,
      wallet_address: typeof body.wallet_address === "string" ? body.wallet_address : undefined,
    })

    return NextResponse.json(data)
  } catch (error) {
    return apiError("E9098", "Failed to fetch transaction history", 500, error)
  }
}
