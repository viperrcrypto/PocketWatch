import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6010", "Authentication required", 401)

  const cardId = new URL(req.url).searchParams.get("cardId")
  if (!cardId) return apiError("F6011", "cardId required", 400)

  try {
    const card = await db.creditCardProfile.findFirst({
      where: { id: cardId, userId: user.id },
    })
    if (!card) return apiError("F6012", "Card not found", 404)

    const perks = await db.creditCardPerk.findMany({
      where: { cardProfileId: cardId },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(perks)
  } catch (err) {
    return apiError("F6013", "Failed to fetch perks", 500, err)
  }
}

const createSchema = z.object({
  cardProfileId: z.string().min(1),
  name: z.string().min(1).max(200),
  value: z.number().min(0).default(0),
  isUsed: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6020", "Authentication required", 401)

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError("F6021", parsed.error.issues[0]?.message ?? "Invalid", 400)

  try {
    const card = await db.creditCardProfile.findFirst({
      where: { id: parsed.data.cardProfileId, userId: user.id },
    })
    if (!card) return apiError("F6022", "Card not found", 404)

    const perk = await db.creditCardPerk.create({
      data: {
        cardProfileId: parsed.data.cardProfileId,
        name: parsed.data.name,
        value: parsed.data.value,
        isUsed: parsed.data.isUsed ?? false,
      },
    })

    return NextResponse.json(perk, { status: 201 })
  } catch (err) {
    return apiError("F6023", "Failed to create perk", 500, err)
  }
}

const patchSchema = z.object({
  perkId: z.string().min(1),
  isUsed: z.boolean().optional(),
  usedDate: z.string().optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6030", "Authentication required", 401)

  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return apiError("F6031", "Invalid request", 400)

  try {
    const perk = await db.creditCardPerk.findFirst({
      where: { id: parsed.data.perkId },
      include: { cardProfile: { select: { userId: true } } },
    })
    if (!perk || perk.cardProfile.userId !== user.id) {
      return apiError("F6032", "Perk not found", 404)
    }

    const updated = await db.creditCardPerk.update({
      where: { id: parsed.data.perkId },
      data: {
        ...(parsed.data.isUsed !== undefined && { isUsed: parsed.data.isUsed }),
        ...(parsed.data.usedDate && { usedDate: new Date(parsed.data.usedDate) }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    return apiError("F6033", "Failed to update perk", 500, err)
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6040", "Authentication required", 401)

  const perkId = new URL(req.url).searchParams.get("perkId")
  if (!perkId) return apiError("F6041", "perkId required", 400)

  try {
    const perk = await db.creditCardPerk.findFirst({
      where: { id: perkId },
      include: { cardProfile: { select: { userId: true } } },
    })
    if (!perk || perk.cardProfile.userId !== user.id) {
      return apiError("F6042", "Perk not found", 404)
    }

    await db.creditCardPerk.delete({ where: { id: perkId } })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("F6043", "Failed to delete perk", 500, err)
  }
}
