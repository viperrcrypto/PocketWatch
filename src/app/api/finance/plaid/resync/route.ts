import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { syncAllPlaidData } from "@/lib/finance/plaid-data-sync"
import { financeRateLimiters, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("FPR10", "Authentication required", 401)

  const rl = financeRateLimiters.sync(`sync:${user.id}`)
  if (!rl.success) {
    return apiError("FPR12", "Rate limit exceeded. Try again later.", 429, undefined, rateLimitHeaders(rl))
  }

  try {
    const report = await syncAllPlaidData(user.id)
    return NextResponse.json(report)
  } catch (err) {
    return apiError("FPR11", "Failed to sync Plaid data", 500, err)
  }
}
