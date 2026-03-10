import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"

/**
 * Fallback catch-all for any /api/portfolio/* route not handled by a specific route file.
 * All primary routes (balances, accounts, settings, external-services, etc.) have their
 * own route.ts files and take precedence over this catch-all.
 */
async function handler(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getCurrentUser()
  if (!user) {
    return apiError("E7070", "Authentication required", 401)
  }

  const { path } = await params
  const targetPath = path.join("/")

  // Known unimplemented routes — return sensible empty responses
  if (targetPath === "assets" || targetPath === "assets/mappings") {
    return NextResponse.json({ assets: {}, asset_collections: {} })
  }

  if (targetPath === "tasks") {
    return NextResponse.json({ status: null })
  }

  if (targetPath === "history") {
    return NextResponse.json({ success: true })
  }

  if (targetPath === "history/pnl" || targetPath === "history/pnl/all") {
    return NextResponse.json({ data: [] })
  }

  console.warn(`[portfolio] Unhandled route: ${request.method} /api/portfolio/${targetPath}`)

  return NextResponse.json(
    { error: "Not implemented", path: targetPath },
    { status: 501 }
  )
}

export const maxDuration = 30

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
