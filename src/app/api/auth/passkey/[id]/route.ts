import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("E1250", "Authentication required", 401)

    const { id } = await params
    const body = await request.json().catch(() => null)
    if (!body || typeof body.name !== "string" || !body.name.trim()) {
      return apiError("E1251", "Name is required", 400)
    }

    const passkey = await db.passkey.findUnique({ where: { id } })
    if (!passkey || passkey.userId !== user.id) {
      return apiError("E1252", "Passkey not found", 404)
    }

    await db.passkey.update({
      where: { id },
      data: { name: body.name.trim() },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E1259", "Failed to rename passkey", 500, error)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("E1260", "Authentication required", 401)

    const { id } = await params
    const passkey = await db.passkey.findUnique({ where: { id } })
    if (!passkey || passkey.userId !== user.id) {
      return apiError("E1261", "Passkey not found", 404)
    }

    await db.passkey.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E1269", "Failed to delete passkey", 500, error)
  }
}
