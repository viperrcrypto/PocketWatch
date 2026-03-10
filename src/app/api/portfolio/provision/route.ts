import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9010", "Authentication required", 401)

  try {
    await db.portfolioSetting.upsert({
      where: { userId: user.id },
      create: { userId: user.id, currency: "USD" },
      update: {},
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E9011", "Failed to provision portfolio", 500, error)
  }
}
