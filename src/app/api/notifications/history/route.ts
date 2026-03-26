/**
 * Notification history — paginated, filterable, with mark-as-read.
 *
 * GET  — fetch notifications (newest first, paginated)
 * POST — mark specific notifications as read
 * PUT  — mark ALL as read
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("NH001", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100)
  const offset = parseInt(searchParams.get("offset") ?? "0", 10)
  const category = searchParams.get("category") || undefined
  const severity = searchParams.get("severity") || undefined

  try {
    const where: Record<string, unknown> = { userId: user.id }
    if (category) where.category = category
    if (severity) where.severity = severity

    const [items, total] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { sentAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          category: true,
          alertType: true,
          severity: true,
          title: true,
          body: true,
          metadata: true,
          channels: true,
          readAt: true,
          sentAt: true,
        },
      }),
      db.notification.count({ where }),
    ])

    return NextResponse.json({ items, total, limit, offset })
  } catch (err) {
    return apiError("NH002", "Failed to fetch notifications", 500, err)
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("NH010", "Authentication required", 401)

  const body = await req.json().catch(() => null)
  const ids = body?.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return apiError("NH011", "ids array required", 400)
  }

  try {
    const result = await db.notification.updateMany({
      where: { id: { in: ids }, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ updated: result.count })
  } catch (err) {
    return apiError("NH012", "Failed to mark notifications read", 500, err)
  }
}

export async function PUT() {
  const user = await getCurrentUser()
  if (!user) return apiError("NH020", "Authentication required", 401)

  try {
    const result = await db.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    })
    return NextResponse.json({ updated: result.count })
  } catch (err) {
    return apiError("NH022", "Failed to mark all read", 500, err)
  }
}
