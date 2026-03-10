import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { syncInstitution, saveFinanceSnapshot } from "@/lib/finance/sync"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const syncSchema = z.object({
  institutionId: z.string().min(1).max(100).optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F2010", "Authentication required", 401)

  const body = await req.json().catch(() => ({}))
  const parsed = syncSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F2012", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const where = parsed.data.institutionId
      ? { id: parsed.data.institutionId, userId: user.id, provider: "simplefin" as const }
      : { userId: user.id, provider: "simplefin" as const }

    const institutions = await db.financeInstitution.findMany({ where })

    const results = await Promise.all(
      institutions.map((inst) => syncInstitution(inst.id))
    )

    await saveFinanceSnapshot(user.id)
    return NextResponse.json({ results })
  } catch (err) {
    const mapped = mapFinanceError(err, "SimpleFIN sync failed")
    return apiError("F2011", mapped.message, mapped.status, err)
  }
}
