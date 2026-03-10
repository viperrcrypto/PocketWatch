import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** GET /api/portfolio/settings — get portfolio settings */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9080", "Authentication required", 401)

  try {
    const settings = await db.portfolioSetting.findUnique({
      where: { userId: user.id },
    })

    return NextResponse.json({
      currency: settings?.currency ?? "USD",
      settings: settings?.settings ?? {},
    })
  } catch (error) {
    return apiError("E9081", "Failed to load settings", 500, error)
  }
}

/** PUT /api/portfolio/settings — update portfolio settings */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9082", "Authentication required", 401)

  try {
    const body = await request.json()
    const { currency, ...extraSettings } = body

    // Merge new settings into existing JSON to avoid overwriting unrelated keys
    const existing = await db.portfolioSetting.findUnique({ where: { userId: user.id } })
    const currentSettings = (existing?.settings as Record<string, unknown>) ?? {}
    const merged = { ...currentSettings, ...extraSettings }
    const hasSettings = Object.keys(merged).length > 0

    const updated = await db.portfolioSetting.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        currency: currency ?? "USD",
        settings: hasSettings ? merged : undefined,
      },
      update: {
        ...(currency ? { currency } : {}),
        ...(hasSettings ? { settings: merged } : {}),
      },
    })

    return NextResponse.json({
      currency: updated.currency,
      settings: updated.settings ?? {},
    })
  } catch (error) {
    return apiError("E9083", "Failed to update settings", 500, error)
  }
}
