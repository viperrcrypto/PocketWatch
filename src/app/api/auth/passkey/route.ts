import { NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("E1240", "Authentication required", 401)

    const passkeys = await db.passkey.findMany({
      where: { userId: user.id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ passkeys })
  } catch (error) {
    return apiError("E1249", "Failed to list passkeys", 500, error)
  }
}
