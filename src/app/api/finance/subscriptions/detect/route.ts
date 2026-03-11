import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { mapFinanceError } from "@/lib/finance/error-map"
import { detectAndSaveSubscriptions } from "@/lib/finance/sync/detect-subscriptions"
import { financeRateLimiters, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("F6020", "Authentication required", 401)

  const rl = financeRateLimiters.detect(`detect:${user.id}`)
  if (!rl.success) {
    return apiError("F6025", "Rate limit exceeded. Try again later.", 429, undefined, rateLimitHeaders(rl))
  }

  try {
    const result = await detectAndSaveSubscriptions(user.id)
    return NextResponse.json(result)
  } catch (err) {
    const mapped = mapFinanceError(err, "Subscription detection failed")
    return apiError("F6021", mapped.message, mapped.status, err)
  }
}
