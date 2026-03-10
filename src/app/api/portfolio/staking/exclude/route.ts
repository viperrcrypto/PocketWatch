import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { invalidateStakingResponseCache } from "../route"

/** PATCH /api/portfolio/staking/exclude — toggle excludeFromYield for a position */
export async function PATCH(request: Request) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9080", "Authentication required", 401)

  try {
    const body = await request.json()
    const { positionKey, exclude } = body as { positionKey?: string; exclude?: boolean }

    if (!positionKey || typeof positionKey !== "string") {
      return apiError("E9081", "positionKey is required", 400)
    }
    if (typeof exclude !== "boolean") {
      return apiError("E9082", "exclude must be a boolean", 400)
    }

    const position = await db.stakingPosition.findUnique({
      where: { userId_positionKey: { userId: user.id, positionKey } },
      select: { id: true },
    })

    if (!position) {
      return apiError("E9083", "Position not found", 404)
    }

    await db.stakingPosition.update({
      where: { userId_positionKey: { userId: user.id, positionKey } },
      data: { excludeFromYield: exclude },
    })

    invalidateStakingResponseCache(user.id)

    return NextResponse.json({ ok: true, positionKey, excludeFromYield: exclude })
  } catch (error) {
    return apiError("E9084", "Failed to update position", 500, error)
  }
}
