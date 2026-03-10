import { NextResponse } from "next/server"
import { runNextPortfolioRefreshJobs } from "@/lib/portfolio/refresh-orchestrator"

export const maxDuration = 300

function isAuthorized(request: Request): boolean {
  const secret = process.env.PORTFOLIO_REFRESH_CRON_SECRET
  if (!secret) return false

  const headerSecret = request.headers.get("x-portfolio-refresh-cron-secret")
  if (headerSecret && headerSecret === secret) return true

  const auth = request.headers.get("authorization")
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim() === secret
  }

  return false
}

/**
 * POST /api/internal/portfolio/refresh-worker
 * Secret-protected worker that processes queued/running portfolio refresh jobs.
 *
 * Query params:
 *  - limit: max jobs per invocation (default 25, max 100)
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? "25", 10) || 25))

  const result = await runNextPortfolioRefreshJobs(limit)

  return NextResponse.json({
    ...result,
    limit,
    finished: result.processed < limit,
    ranAt: new Date().toISOString(),
  })
}
