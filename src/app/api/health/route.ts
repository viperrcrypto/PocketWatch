/**
 * GET /api/health
 * Lightweight, unauthenticated health check.
 * No database queries — just confirms the process is alive.
 */
import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
}
