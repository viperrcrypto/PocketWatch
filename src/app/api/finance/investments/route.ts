import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

const INVESTMENT_TYPES = ["investment", "brokerage"] as const

const MANUAL_INSTITUTION_NAME = "Manual"
const MANUAL_PROVIDER = "manual"

// ─── GET: All investment/brokerage accounts grouped by institution ───

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F9001", "Authentication required", 401)

  try {
    const institutions = await db.financeInstitution.findMany({
      where: { userId: user.id },
      include: {
        accounts: {
          where: { type: { in: [...INVESTMENT_TYPES] } },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { institutionName: "asc" },
    })

    // Only return institutions that have investment accounts
    const result = institutions
      .filter((inst) => inst.accounts.length > 0)
      .map((inst) => ({
        id: inst.id,
        provider: inst.provider,
        institutionName: inst.institutionName,
        institutionLogo: inst.institutionLogo,
        lastSyncedAt: inst.lastSyncedAt,
        accounts: inst.accounts.map((a) => ({
          id: a.id,
          name: a.name,
          officialName: a.officialName,
          type: a.type,
          subtype: a.subtype,
          currentBalance: a.currentBalance,
          currency: a.currency,
          isHidden: a.isHidden,
          updatedAt: a.updatedAt,
        })),
      }))

    const totalValue = result.reduce(
      (sum, inst) =>
        sum + inst.accounts.reduce((s, a) => s + (a.currentBalance ?? 0), 0),
      0
    )

    return NextResponse.json({ institutions: result, totalValue })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch investments")
    return apiError("F9002", mapped.message, mapped.status, err)
  }
}

// ─── POST: Create manual investment entry ────────────────────────

const createSchema = z.object({
  name: z.string().min(1).max(200),
  value: z.number().min(0),
  type: z.enum(["stocks", "bonds", "real_estate", "crypto", "other"]).default("other"),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9003", "Authentication required", 401)

  try {
    const body = await req.json()
    const parsed = createSchema.parse(body)

    // Find or create the "Manual" institution for this user
    let manualInst = await db.financeInstitution.findFirst({
      where: { userId: user.id, provider: MANUAL_PROVIDER },
    })

    if (!manualInst) {
      manualInst = await db.financeInstitution.create({
        data: {
          userId: user.id,
          provider: MANUAL_PROVIDER,
          institutionName: MANUAL_INSTITUTION_NAME,
          status: "active",
        },
      })
    }

    const account = await db.financeAccount.create({
      data: {
        userId: user.id,
        institutionId: manualInst.id,
        externalId: `manual_inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: parsed.name,
        officialName: parsed.name,
        type: "investment",
        subtype: parsed.type,
        currentBalance: parsed.value,
        currency: "USD",
      },
    })

    return NextResponse.json(account, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError("F9004", `Validation error: ${err.issues[0]?.message}`, 400)
    }
    const mapped = mapFinanceError(err, "Failed to create investment")
    return apiError("F9005", mapped.message, mapped.status, err)
  }
}

// ─── PATCH: Update manual investment balance ─────────────────────

const updateSchema = z.object({
  accountId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  value: z.number().min(0).optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9006", "Authentication required", 401)

  try {
    const body = await req.json()
    const parsed = updateSchema.parse(body)

    // Verify the account belongs to this user and is manual
    const account = await db.financeAccount.findFirst({
      where: { id: parsed.accountId, userId: user.id },
      include: { institution: true },
    })

    if (!account) {
      return apiError("F9007", "Investment account not found", 404)
    }

    if (account.institution.provider !== MANUAL_PROVIDER) {
      return apiError("F9008", "Only manual investments can be updated this way", 400)
    }

    const data: Record<string, unknown> = {}
    if (parsed.name !== undefined) {
      data.name = parsed.name
      data.officialName = parsed.name
    }
    if (parsed.value !== undefined) {
      data.currentBalance = parsed.value
    }

    const updated = await db.financeAccount.update({
      where: { id: parsed.accountId },
      data,
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return apiError("F9009", `Validation error: ${err.issues[0]?.message}`, 400)
    }
    const mapped = mapFinanceError(err, "Failed to update investment")
    return apiError("F9010", mapped.message, mapped.status, err)
  }
}

// ─── DELETE: Delete manual investment entry ──────────────────────

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F9011", "Authentication required", 401)

  try {
    const { searchParams } = new URL(req.url)
    const accountId = searchParams.get("accountId")
    if (!accountId) {
      return apiError("F9012", "accountId is required", 400)
    }

    const account = await db.financeAccount.findFirst({
      where: { id: accountId, userId: user.id },
      include: { institution: true },
    })

    if (!account) {
      return apiError("F9013", "Investment account not found", 404)
    }

    if (account.institution.provider !== MANUAL_PROVIDER) {
      return apiError("F9014", "Only manual investments can be deleted", 400)
    }

    await db.financeAccount.delete({ where: { id: accountId } })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to delete investment")
    return apiError("F9015", mapped.message, mapped.status, err)
  }
}
