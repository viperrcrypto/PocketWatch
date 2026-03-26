/**
 * Notification preferences — per-category enable/disable, per-channel
 * severity routing, quiet hours configuration.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

const DEFAULT_CATEGORIES: Record<string, boolean> = {
  finance: true,
  crypto: true,
  travel: true,
  system: true,
}

const DEFAULT_CHANNEL_SEVERITY: Record<string, string> = {
  brrr: "info",
  telegram: "urgent",
  webpush: "watch",
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("NP001", "Authentication required", 401)

  try {
    const prefs = await db.notificationPreference.findUnique({
      where: { userId: user.id },
    })

    if (!prefs) {
      return NextResponse.json({
        channelSeverity: DEFAULT_CHANNEL_SEVERITY,
        categories: DEFAULT_CATEGORIES,
        quietEnabled: false,
        quietStart: "22:00",
        quietEnd: "07:00",
        quietOverride: true,
      })
    }

    return NextResponse.json({
      channelSeverity: prefs.channelSeverity,
      categories: prefs.categories,
      quietEnabled: prefs.quietEnabled,
      quietStart: prefs.quietStart,
      quietEnd: prefs.quietEnd,
      quietOverride: prefs.quietOverride,
    })
  } catch (err) {
    return apiError("NP002", "Failed to load preferences", 500, err)
  }
}

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("NP010", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  if (!body) return apiError("NP011", "Invalid request body", 400)

  try {
    const data: Record<string, unknown> = {}

    if (body.channelSeverity !== undefined) data.channelSeverity = body.channelSeverity
    if (body.categories !== undefined) data.categories = body.categories
    if (body.quietEnabled !== undefined) data.quietEnabled = Boolean(body.quietEnabled)
    if (body.quietStart !== undefined) data.quietStart = String(body.quietStart)
    if (body.quietEnd !== undefined) data.quietEnd = String(body.quietEnd)
    if (body.quietOverride !== undefined) data.quietOverride = Boolean(body.quietOverride)

    const prefs = await db.notificationPreference.upsert({
      where: { userId: user.id },
      update: data,
      create: {
        userId: user.id,
        channelSeverity: body.channelSeverity ?? DEFAULT_CHANNEL_SEVERITY,
        categories: body.categories ?? DEFAULT_CATEGORIES,
        quietEnabled: body.quietEnabled ?? false,
        quietStart: body.quietStart ?? "22:00",
        quietEnd: body.quietEnd ?? "07:00",
        quietOverride: body.quietOverride ?? true,
      },
    })

    return NextResponse.json({ ok: true, preferences: prefs })
  } catch (err) {
    return apiError("NP012", "Failed to save preferences", 500, err)
  }
}
