import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { getCurrentUser } from "@/lib/auth"
import { rateLimit, getClientId, rateLimitHeaders } from "@/lib/rate-limit"

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientId(request)
    const rateLimitResult = rateLimit(`auth:me:${clientId}`, { limit: 60, windowSeconds: 60 })
    if (!rateLimitResult.success) {
      return apiError("E1060", "Too many requests. Please try again later.", 429, undefined, rateLimitHeaders(rateLimitResult))
    }

    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        createdAt: user.createdAt,
      },
    })
  } catch (error) {
    return apiError("E1061", "Failed to get user", 500, error)
  }
}
