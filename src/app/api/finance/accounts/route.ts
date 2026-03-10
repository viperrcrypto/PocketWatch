import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { mapFinanceError } from "@/lib/finance/error-map"
import { resolveInstitutionLogo } from "@/lib/finance/institution-logos"
import { removeItem } from "@/lib/finance/plaid-client"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F3001", "Authentication required", 401)

  try {
    const institutions = await db.financeInstitution.findMany({
      where: { userId: user.id, status: { not: "disconnected" } },
      include: {
        accounts: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { institutionName: "asc" },
    })

    // Backfill missing, stale (Clearbit), or raw base64 logos
    const backfillPromises: Promise<unknown>[] = []
    for (const inst of institutions) {
      const logo = inst.institutionLogo
      const isStale = !logo || logo.includes("logo.clearbit.com")
      const isRawBase64 = logo && logo.length > 100 && !logo.startsWith("http") && !logo.startsWith("data:")

      if (isRawBase64) {
        // Fix raw base64 by adding the data URI prefix
        const fixed = `data:image/png;base64,${logo}`
        inst.institutionLogo = fixed
        backfillPromises.push(
          db.financeInstitution.update({
            where: { id: inst.id },
            data: { institutionLogo: fixed },
          })
        )
      } else if (isStale) {
        const resolved = resolveInstitutionLogo(null, null, inst.institutionName)
        if (resolved) {
          inst.institutionLogo = resolved
          backfillPromises.push(
            db.financeInstitution.update({
              where: { id: inst.id },
              data: { institutionLogo: resolved },
            })
          )
        }
      }
    }
    // Fire-and-forget — don't block the response
    if (backfillPromises.length > 0) {
      Promise.all(backfillPromises).catch(console.error)
    }

    const result = institutions.map((inst) => ({
      id: inst.id,
      provider: inst.provider,
      institutionName: inst.institutionName,
      institutionLogo: inst.institutionLogo,
      status: inst.status,
      errorMessage: inst.errorMessage,
      lastSyncedAt: inst.lastSyncedAt,
      accounts: inst.accounts.map((a) => ({
        id: a.id,
        externalId: a.externalId,
        linkedExternalId: a.linkedExternalId,
        name: a.name,
        officialName: a.officialName,
        type: a.type,
        subtype: a.subtype,
        mask: a.mask,
        currentBalance: a.currentBalance,
        availableBalance: a.availableBalance,
        creditLimit: a.creditLimit,
        currency: a.currency,
        isHidden: a.isHidden,
      })),
    }))

    return NextResponse.json(result)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch accounts")
    return apiError("F3002", mapped.message, mapped.status, err)
  }
}

const accountPatchSchema = z.object({
  accountId: z.string().min(1, "accountId required"),
  name: z.string().min(1).max(200).optional(),
  isHidden: z.boolean().optional(),
})

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F3010", "Authentication required", 401)

  const body = await req.json()
  const parsed = accountPatchSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F3011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { accountId, name, isHidden } = parsed.data

  try {
    const account = await db.financeAccount.findFirst({
      where: { id: accountId, userId: user.id },
    })
    if (!account) return apiError("F3012", "Account not found", 404)

    const updated = await db.financeAccount.update({
      where: { id: accountId },
      data: {
        ...(name !== undefined && { name }),
        ...(isHidden !== undefined && { isHidden }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to update account")
    return apiError("F3013", mapped.message, mapped.status, err)
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F3020", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const institutionId = searchParams.get("institutionId")
  if (!institutionId) return apiError("F3021", "institutionId required", 400)

  try {
    const institution = await db.financeInstitution.findFirst({
      where: { id: institutionId, userId: user.id },
    })
    if (!institution) return apiError("F3022", "Institution not found", 404)

    // Remove from Plaid if applicable
    if (institution.provider === "plaid" && institution.plaidAccessToken) {
      try {
        const token = await decryptCredential(institution.plaidAccessToken)
        await removeItem(user.id, token)
      } catch {
        // Best effort — continue with local cleanup
      }
    }

    // Cascade delete handles accounts + transactions
    await db.financeInstitution.delete({
      where: { id: institutionId },
    })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to disconnect institution")
    return apiError("F3023", mapped.message, mapped.status, err)
  }
}
