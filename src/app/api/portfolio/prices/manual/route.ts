import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** GET /api/portfolio/prices/manual — list all manual price overrides */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9300", "Authentication required", 401)

  try {
    const prices = await db.manualPrice.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    })

    return NextResponse.json({ prices })
  } catch (error) {
    return apiError("E9301", "Failed to fetch manual prices", 500, error)
  }
}

/** PUT /api/portfolio/prices/manual — set a manual price override
 *  Body: { chain, asset, symbol, priceUsd }
 *  Upserts by (userId, chain, asset). Also backfills usdValue on
 *  all matching TransactionCache rows that are currently null. */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9302", "Authentication required", 401)

  try {
    const body = await request.json()
    const { chain, asset, symbol, priceUsd } = body

    if (!chain || !asset || !symbol || priceUsd == null) {
      return apiError("E9303", "Missing required fields: chain, asset, symbol, priceUsd", 400)
    }

    if (typeof priceUsd !== "number" || priceUsd < 0) {
      return apiError("E9304", "priceUsd must be a non-negative number", 400)
    }

    // Upsert the manual price
    const price = await db.manualPrice.upsert({
      where: { userId_chain_asset: { userId: user.id, chain, asset } },
      create: { userId: user.id, chain, asset, symbol, priceUsd },
      update: { priceUsd, symbol },
    })

    // Backfill: apply this price to all unpriced TransactionCache rows for this asset
    // Uses a single SQL UPDATE instead of N individual updates
    const backfilled = await db.$executeRaw`
      UPDATE "TransactionCache"
      SET "usdValue" = COALESCE(value, 0) * ${priceUsd}
      WHERE "userId" = ${user.id}
      AND chain = ${chain}
      AND asset = ${asset}
      AND "usdValue" IS NULL
      AND value IS NOT NULL
    `

    return NextResponse.json({
      success: true,
      price,
      backfilled,
    })
  } catch (error) {
    return apiError("E9305", "Failed to set manual price", 500, error)
  }
}

/** DELETE /api/portfolio/prices/manual — remove a manual price override
 *  Body: { chain, asset } */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9306", "Authentication required", 401)

  try {
    const body = await request.json()
    const { chain, asset } = body

    if (!chain || !asset) {
      return apiError("E9307", "Missing required fields: chain, asset", 400)
    }

    await db.manualPrice.deleteMany({
      where: { userId: user.id, chain, asset },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E9308", "Failed to delete manual price", 500, error)
  }
}
