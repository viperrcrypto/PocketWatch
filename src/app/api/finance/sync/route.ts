import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { invalidateCache } from "@/lib/cache"
import { syncAllInstitutions, syncInstitution, saveFinanceSnapshot, backfillHistoricalSnapshots } from "@/lib/finance/sync"
import { detectAndSaveSubscriptions } from "@/lib/finance/sync/detect-subscriptions"
import { financeRateLimiters, getClientId, rateLimitHeaders } from "@/lib/rate-limit"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const syncSchema = z.object({
  institutionId: z.string().min(1).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8050", "Authentication required", 401)

  const rl = financeRateLimiters.sync(`sync:${user.id}`)
  if (!rl.success) {
    return apiError("F8053", "Sync rate limit exceeded. Try again later.", 429, undefined, rateLimitHeaders(rl))
  }

  const body = await req.json().catch(() => ({}))
  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F8054", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }
  const { institutionId } = parsed.data

  try {
    if (institutionId) {
      // Verify institution belongs to the requesting user
      const institution = await db.financeInstitution.findFirst({
        where: { id: institutionId, userId: user.id },
      })
      if (!institution) {
        return apiError("F8052", "Institution not found", 404)
      }

      const result = await syncInstitution(institutionId)
      await saveFinanceSnapshot(user.id)
      await backfillHistoricalSnapshots(user.id)
      invalidateCache(`deep-insights:${user.id}`)
      invalidateCache(`budget-suggest:${user.id}`)
      invalidateCache(`budget-ai:${user.id}`)
      detectAndSaveSubscriptions(user.id).catch((e: unknown) =>
        console.warn("[sync] Subscription detection failed:", e)
      )
      return NextResponse.json(result)
    }

    const results = await syncAllInstitutions(user.id)
    await saveFinanceSnapshot(user.id)
    await backfillHistoricalSnapshots(user.id)
    invalidateCache(`deep-insights:${user.id}`)
    invalidateCache(`budget-suggest:${user.id}`)
    invalidateCache(`budget-ai:${user.id}`)
    detectAndSaveSubscriptions(user.id).catch((e: unknown) =>
      console.warn("[sync] Subscription detection failed:", e)
    )
    return NextResponse.json({ results })
  } catch (err) {
    const mapped = mapFinanceError(err, "Sync failed")
    return apiError("F8051", mapped.message, mapped.status, err)
  }
}
