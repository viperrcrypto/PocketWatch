/**
 * Notification channel settings CRUD.
 *
 * GET  — list configured channels (masked secrets)
 * POST — save a channel config (brrr webhook URL or telegram bot+chatId)
 * DELETE — remove a channel
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { encryptCredential, decryptCredential } from "@/lib/finance/crypto"
import { getChannelStatus } from "@/lib/notifications/dispatcher"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const VALID_CHANNELS = new Set(["notify_brrr", "notify_telegram"])

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("N3001", "Authentication required", 401)

  try {
    const status = await getChannelStatus(user.id)

    // Get masked config for each channel
    const keys = await db.externalApiKey.findMany({
      where: { userId: user.id, serviceName: { in: [...VALID_CHANNELS] } },
      select: { serviceName: true, updatedAt: true },
    })

    const channels = status.map((ch) => {
      const key = keys.find((k) =>
        (ch.channel === "brrr" && k.serviceName === "notify_brrr") ||
        (ch.channel === "telegram" && k.serviceName === "notify_telegram"),
      )
      return {
        ...ch,
        updatedAt: key?.updatedAt?.toISOString() ?? null,
      }
    })

    // Recent alerts
    const recentAlerts = await db.financeAlert.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: "desc" },
      take: 20,
      select: {
        id: true,
        alertType: true,
        title: true,
        message: true,
        amount: true,
        merchantName: true,
        sentAt: true,
        channels: true,
      },
    })

    return NextResponse.json({ channels, recentAlerts })
  } catch (err) {
    return apiError("N3002", "Failed to fetch notification settings", 500, err)
  }
}

const brrrSchema = z.object({
  channel: z.literal("notify_brrr"),
  webhookUrl: z.string().min(1, "Webhook URL is required"),
})

const telegramSchema = z.object({
  channel: z.literal("notify_telegram"),
  botToken: z.string().min(1, "Bot token is required"),
  chatId: z.string().min(1, "Chat ID is required"),
})

const saveSchema = z.union([brrrSchema, telegramSchema])

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("N3010", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("N3011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const data = parsed.data
    let encryptedValue: string

    if (data.channel === "notify_brrr") {
      encryptedValue = await encryptCredential(data.webhookUrl)
    } else {
      encryptedValue = await encryptCredential(JSON.stringify({
        botToken: data.botToken,
        chatId: data.chatId,
      }))
    }

    const existing = await db.externalApiKey.findFirst({
      where: { userId: user.id, serviceName: data.channel },
    })

    if (existing) {
      await db.externalApiKey.update({
        where: { id: existing.id },
        data: { apiKeyEnc: encryptedValue, verified: true },
      })
    } else {
      await db.externalApiKey.create({
        data: {
          userId: user.id,
          serviceName: data.channel,
          apiKeyEnc: encryptedValue,
          verified: true,
        },
      })
    }

    return NextResponse.json({ saved: true, channel: data.channel })
  } catch (err) {
    return apiError("N3012", "Failed to save notification settings", 500, err)
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("N3020", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const channel = searchParams.get("channel")
  if (!channel || !VALID_CHANNELS.has(channel)) {
    return apiError("N3021", "Invalid channel", 400)
  }

  try {
    await db.externalApiKey.deleteMany({
      where: { userId: user.id, serviceName: channel },
    })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return apiError("N3022", "Failed to delete channel", 500, err)
  }
}
