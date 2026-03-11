import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { resetVault, getCurrentUser } from "@/lib/auth"
import { cookies } from "next/headers"
import { SESSION_COOKIE } from "@/lib/auth"
import { rateLimit } from "@/lib/rate-limit"

export async function POST(request: NextRequest) {
  // Rate limit to prevent abuse
  const clientId = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for") ?? "unknown"
  const rl = rateLimit(`auth:reset:${clientId}`, { limit: 3, windowSeconds: 300 })
  if (!rl.allowed) {
    return apiError("E1091", "Too many reset attempts. Try again later.", 429)
  }

  // Require authentication — only a logged-in user can reset
  const user = await getCurrentUser()
  if (!user) {
    return apiError("E1092", "Authentication required to reset vault", 401)
  }

  try {
    await resetVault()

    // Clear the session cookie
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE)

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E1090", "Vault reset failed", 500, error)
  }
}
