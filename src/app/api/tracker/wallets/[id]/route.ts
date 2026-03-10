import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** PATCH /api/tracker/wallets/:id — update wallet label/emoji/active */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return apiError("T2001", "Authentication required", 401)

  const { id } = await params

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.label !== undefined) data.label = body.label || null
    if (body.emoji !== undefined) data.emoji = body.emoji || null
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive)

    if (Object.keys(data).length === 0) {
      return apiError("T2002", "No fields to update", 400)
    }

    const wallet = await db.trackedWallet.updateMany({
      where: { id, userId: user.id },
      data,
    })

    if (wallet.count === 0) {
      return apiError("T2003", "Wallet not found", 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("T2004", "Failed to update wallet", 500, error)
  }
}

/** DELETE /api/tracker/wallets/:id — remove a tracked wallet */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser()
  if (!user) return apiError("T2005", "Authentication required", 401)

  const { id } = await params

  try {
    const deleted = await db.trackedWallet.deleteMany({
      where: { id, userId: user.id },
    })

    if (deleted.count === 0) {
      return apiError("T2006", "Wallet not found", 404)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("T2007", "Failed to delete wallet", 500, error)
  }
}
