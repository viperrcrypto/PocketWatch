import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6050", "Authentication required", 401)

  const cardId = new URL(req.url).searchParams.get("cardId")
  if (!cardId) return apiError("F6051", "cardId required", 400)

  try {
    const card = await db.creditCardProfile.findFirst({
      where: { id: cardId, userId: user.id },
    })
    if (!card) return apiError("F6052", "Card not found", 404)

    const rates = await db.creditCardRewardRate.findMany({
      where: { cardProfileId: cardId },
      orderBy: { rewardRate: "desc" },
    })

    return NextResponse.json(rates)
  } catch (err) {
    return apiError("F6053", "Failed to fetch reward rates", 500, err)
  }
}

const createSchema = z.object({
  cardProfileId: z.string().min(1),
  spendingCategory: z.string().min(1),
  rewardRate: z.number().min(0).max(50),
  rewardType: z.enum(["cashback", "points", "miles"]),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6060", "Authentication required", 401)

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return apiError("F6061", parsed.error.issues[0]?.message ?? "Invalid", 400)

  try {
    const card = await db.creditCardProfile.findFirst({
      where: { id: parsed.data.cardProfileId, userId: user.id },
    })
    if (!card) return apiError("F6062", "Card not found", 404)

    const rate = await db.creditCardRewardRate.upsert({
      where: {
        cardProfileId_spendingCategory: {
          cardProfileId: parsed.data.cardProfileId,
          spendingCategory: parsed.data.spendingCategory,
        },
      },
      create: {
        cardProfileId: parsed.data.cardProfileId,
        spendingCategory: parsed.data.spendingCategory,
        rewardRate: parsed.data.rewardRate,
        rewardType: parsed.data.rewardType,
      },
      update: {
        rewardRate: parsed.data.rewardRate,
        rewardType: parsed.data.rewardType,
      },
    })

    return NextResponse.json(rate, { status: 201 })
  } catch (err) {
    return apiError("F6063", "Failed to save reward rate", 500, err)
  }
}

const deleteSchema = z.object({
  rateId: z.string().min(1),
})

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F6070", "Authentication required", 401)

  const body = await req.json()
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return apiError("F6071", parsed.error.issues[0]?.message ?? "Invalid", 400)

  try {
    const rate = await db.creditCardRewardRate.findFirst({
      where: { id: parsed.data.rateId },
      include: { cardProfile: { select: { userId: true } } },
    })
    if (!rate || rate.cardProfile.userId !== user.id) {
      return apiError("F6072", "Reward rate not found", 404)
    }

    await db.creditCardRewardRate.delete({ where: { id: parsed.data.rateId } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return apiError("F6073", "Failed to delete reward rate", 500, err)
  }
}
