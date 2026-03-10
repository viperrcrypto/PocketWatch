import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { computeCostBasis } from "@/lib/portfolio/cost-basis-engine"
import { db } from "@/lib/db"

export const maxDuration = 120

/** POST /api/portfolio/analytics/compute — Trigger cost-basis computation (idempotent) */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9200", "Authentication required", 401)

  // Atomic concurrency guard — compare-and-set via raw SQL to prevent race conditions.
  // Two concurrent requests cannot both pass this check.
  const lockAcquired = await db.$executeRaw`
    UPDATE "PortfolioSetting"
    SET settings = COALESCE(settings, '{}'::jsonb) || '{"costBasisComputing": true}'::jsonb
    WHERE "userId" = ${user.id}
      AND (settings IS NULL OR (settings->>'costBasisComputing')::boolean IS NOT TRUE)
  `

  if (lockAcquired === 0) {
    // Either no PortfolioSetting row exists, or lock is already held
    // Try to create the row if it doesn't exist
    const existing = await db.portfolioSetting.findUnique({ where: { userId: user.id } })
    if (!existing) {
      await db.portfolioSetting.create({
        data: { userId: user.id, settings: { costBasisComputing: true } },
      })
    } else {
      return apiError("E9202", "Cost basis computation already in progress", 409)
    }
  }

  try {
    const summary = await computeCostBasis(user.id)
    return NextResponse.json({
      success: true,
      ...summary,
    })
  } catch (error) {
    return apiError("E9201", "Failed to compute cost basis", 500, error)
  } finally {
    // Clear lock — use raw SQL for atomicity, ignore errors to prevent stuck state
    try {
      await db.$executeRaw`
        UPDATE "PortfolioSetting"
        SET settings = settings - 'costBasisComputing'
        WHERE "userId" = ${user.id}
      `
    } catch {
      console.error("[cost-basis] Failed to release compute lock for user", user.id)
    }
  }
}
