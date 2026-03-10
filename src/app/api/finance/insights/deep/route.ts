import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { computeDeepInsights } from "@/lib/finance/deep-insights-engine"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F8010", "Authentication required", 401)

  try {
    const result = await computeDeepInsights(user.id)
    if (!result) return NextResponse.json({ empty: true })
    return NextResponse.json(result)
  } catch (err) {
    return apiError("F8011", "Failed to compute deep insights", 500, err)
  }
}
