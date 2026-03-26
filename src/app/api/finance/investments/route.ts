import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { updateYieldRate, correctYieldBalance } from "@/lib/finance/yield-accrual"
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
    // First pass: find institutions that have investment accounts
    const allInstitutions = await db.financeInstitution.findMany({
      where: { userId: user.id },
      include: {
        accounts: {
          orderBy: { name: "asc" },
          select: {
            id: true, name: true, type: true, subtype: true,
            currentBalance: true, currency: true, isHidden: true, updatedAt: true,
            apy: true, yieldType: true, principalDeposited: true, yieldEarned: true, apyHistory: true,
          },
        },
      },
      orderBy: { institutionName: "asc" },
    })

    // Include investment/brokerage accounts + cash accounts from investment institutions
    const result = allInstitutions
      .filter((inst) => inst.accounts.some((a) => (INVESTMENT_TYPES as readonly string[]).includes(a.type)))
      .map((inst) => ({
        ...inst,
        accounts: inst.accounts.filter((a) =>
          (INVESTMENT_TYPES as readonly string[]).includes(a.type) ||
          a.subtype === "cash management" || a.subtype === "cash" ||
          a.type === "checking"
        ),
      }))
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
          type: a.type,
          subtype: a.subtype,
          currentBalance: a.currentBalance,
          currency: a.currency,
          isHidden: a.isHidden,
          updatedAt: a.updatedAt,
          apy: a.apy,
          yieldType: a.yieldType,
          principalDeposited: a.principalDeposited,
          yieldEarned: a.yieldEarned,
          apyHistory: a.apyHistory,
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
  type: z.enum(["stocks", "bonds", "real_estate", "crypto", "yield", "other"]).default("other"),
  apy: z.number().min(0).max(1).optional(),       // e.g., 0.08 for 8%
  yieldType: z.enum(["fixed", "variable"]).optional(),
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
        apy: parsed.apy ?? null,
        yieldType: parsed.yieldType ?? null,
        principalDeposited: parsed.apy ? parsed.value : null,
        yieldEarned: 0,
        apyHistory: parsed.apy ? [{ apy: parsed.apy, date: new Date().toISOString().split("T")[0], note: "Initial rate" }] : undefined,
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
  apy: z.number().min(0).max(1).nullable().optional(),
  yieldType: z.enum(["fixed", "variable"]).nullable().optional(),
  apyNote: z.string().max(200).optional(),             // note for rate change history
  correctBalance: z.boolean().optional(),               // true = recalculate yieldEarned from principal
  addPrincipal: z.number().min(0).optional(),           // additional deposit to principal
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

    // Prevent conflicting operations
    if (parsed.value !== undefined && parsed.addPrincipal !== undefined) {
      return apiError("F9017", "Provide either 'value' or 'addPrincipal', not both", 400)
    }

    // Handle APY rate change with history tracking
    if (parsed.apy !== undefined && parsed.apy !== null && parsed.apy !== account.apy) {
      await updateYieldRate(parsed.accountId, parsed.apy, parsed.apyNote)
    }

    // Handle balance correction (recalculates yieldEarned from principal) — yield accounts only
    if (parsed.value !== undefined && parsed.correctBalance) {
      if (account.subtype !== "yield") {
        return apiError("F9016", "Balance correction only applies to yield accounts", 400)
      }
      await correctYieldBalance(parsed.accountId, parsed.value)
    }

    // Handle additional principal deposit — re-fetch fresh state after any prior mutations
    if (parsed.addPrincipal && parsed.addPrincipal > 0) {
      const fresh = await db.financeAccount.findUnique({
        where: { id: parsed.accountId },
        select: { principalDeposited: true, currentBalance: true },
      })
      const currentPrincipal = fresh?.principalDeposited ?? fresh?.currentBalance ?? 0
      const currentBalance = fresh?.currentBalance ?? 0
      await db.financeAccount.update({
        where: { id: parsed.accountId },
        data: {
          principalDeposited: Math.round((currentPrincipal + parsed.addPrincipal) * 100) / 100,
          currentBalance: Math.round((currentBalance + parsed.addPrincipal) * 100) / 100,
        },
      })
    }

    const data: Record<string, unknown> = {}
    if (parsed.name !== undefined) {
      data.name = parsed.name
      data.officialName = parsed.name
    }
    if (parsed.value !== undefined && !parsed.correctBalance && !parsed.addPrincipal) {
      data.currentBalance = parsed.value
    }
    if (parsed.yieldType !== undefined) {
      data.yieldType = parsed.yieldType
    }

    // Only update generic fields if there are any
    const updated = Object.keys(data).length > 0
      ? await db.financeAccount.update({ where: { id: parsed.accountId }, data })
      : await db.financeAccount.findUnique({ where: { id: parsed.accountId } })

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
