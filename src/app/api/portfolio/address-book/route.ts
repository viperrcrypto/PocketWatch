import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"

/** GET /api/portfolio/address-book — list address labels */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9100", "Authentication required", 401)

  try {
    const labels = await db.addressLabel.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      addresses: labels.map((l) => ({
        id: l.id,
        address: l.address,
        name: l.name,
        blockchain: l.blockchain,
        createdAt: l.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    return apiError("E9101", "Failed to load address book", 500, error)
  }
}

/** POST /api/portfolio/address-book — add an address label */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9102", "Authentication required", 401)

  try {
    const body = await request.json()
    const { address, name, blockchain } = body

    if (!address || typeof address !== "string") {
      return apiError("E9103", "address is required", 400)
    }
    if (!name || typeof name !== "string") {
      return apiError("E9104", "name is required", 400)
    }

    const label = await db.addressLabel.upsert({
      where: { userId_address: { userId: user.id, address: address.trim() } },
      create: {
        userId: user.id,
        address: address.trim(),
        name: name.trim(),
        blockchain: blockchain ?? null,
      },
      update: {
        name: name.trim(),
        blockchain: blockchain ?? undefined,
      },
    })

    return NextResponse.json({
      label: {
        id: label.id,
        address: label.address,
        name: label.name,
        blockchain: label.blockchain,
        createdAt: label.createdAt.toISOString(),
      },
    })
  } catch (error) {
    return apiError("E9105", "Failed to add address label", 500, error)
  }
}

/** DELETE /api/portfolio/address-book — remove an address label */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9106", "Authentication required", 401)

  try {
    const body = await request.json()
    const { address, blockchain } = body

    if (!address || typeof address !== "string") {
      return apiError("E9107", "address is required", 400)
    }

    await db.addressLabel.deleteMany({
      where: {
        userId: user.id,
        address: address.trim(),
        ...(blockchain ? { blockchain } : {}),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("E9108", "Failed to delete address label", 500, error)
  }
}
