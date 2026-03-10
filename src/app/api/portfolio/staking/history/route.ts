import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getStakingHistoryV2 } from "@/lib/portfolio/staking-lifecycle"
import { getStakingHistory } from "@/lib/portfolio/staking-snapshots"

export const maxDuration = 30

/** GET /api/portfolio/staking/history?year=2026&range=ytd&positionKey=...&protocol=Aave%20V3 */
export async function GET(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9070", "Authentication required", 401)

  const url = new URL(request.url)
  const yearParam = url.searchParams.get("year")
  const rangeParam = (url.searchParams.get("range") ?? "all").toLowerCase()
  const positionKey = url.searchParams.get("positionKey") ?? undefined
  const protocol = url.searchParams.get("protocol") ?? undefined
  const year = yearParam ? parseInt(yearParam, 10) : undefined

  if (year !== undefined && (isNaN(year) || year < 2020 || year > 2100)) {
    return apiError("E9071", "Invalid year parameter", 400)
  }
  if (rangeParam !== "all" && rangeParam !== "ytd" && rangeParam !== "year") {
    return apiError("E9071", "Invalid range parameter", 400)
  }

  try {
    const history = await getStakingHistoryV2(user.id, {
      year,
      range: rangeParam as "all" | "ytd" | "year",
      positionKey,
      protocol,
    })
    return NextResponse.json(history)
  } catch (error) {
    try {
      // Backward-compatible fallback for environments where v2 tables
      // are not migrated yet.
      const legacy = await getStakingHistory(user.id, year)
      return NextResponse.json(legacy)
    } catch {
      return apiError("E9072", "Failed to fetch staking history", 500, error)
    }
  }
}
