import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** GET /api/portfolio/balances/manual — list manual balance entries */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9070", "Authentication required", 401)

  try {
    const balances = await db.manualBalance.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      balances: balances.map((b) => ({
        id: b.id,
        asset: b.asset,
        label: b.label,
        amount: b.amount,
        location: b.location,
        tags: b.tags,
        createdAt: b.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    return apiError("E9071", "Failed to load manual balances", 500, error)
  }
}

/** POST /api/portfolio/balances/manual — add a manual balance entry */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9072", "Authentication required", 401)

  try {
    const body = await request.json()
    const { asset, label, amount, location, tags } = body

    if (!asset || typeof asset !== "string") {
      return apiError("E9073", "asset is required", 400)
    }
    if (!label || typeof label !== "string") {
      return apiError("E9074", "label is required", 400)
    }
    if (!amount || typeof amount !== "string") {
      return apiError("E9075", "amount is required (as string)", 400)
    }

    const balance = await db.manualBalance.create({
      data: {
        userId: user.id,
        asset: asset.trim(),
        label: label.trim(),
        amount: amount.trim(),
        location: location ?? null,
        tags: Array.isArray(tags) ? tags : [],
      },
    })

    return NextResponse.json({
      balance: {
        id: balance.id,
        asset: balance.asset,
        label: balance.label,
        amount: balance.amount,
        location: balance.location,
        tags: balance.tags,
        createdAt: balance.createdAt.toISOString(),
      },
    })
  } catch (error) {
    return apiError("E9076", "Failed to add manual balance", 500, error)
  }
}

/** DELETE /api/portfolio/balances/manual — remove a manual balance */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9077", "Authentication required", 401)

  try {
    const body = await request.json()
    const { id } = body

    if (!id || typeof id !== "string") {
      return apiError("E9078", "id is required", 400)
    }

    await db.manualBalance.deleteMany({
      where: { id, userId: user.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E9079", "Failed to delete manual balance", 500, error)
  }
}
