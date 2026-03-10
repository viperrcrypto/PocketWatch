import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FPS10", "Authentication required", 401)

  try {
    const institutions = await db.financeInstitution.findMany({
      where: { userId: user.id, provider: "plaid", status: "active" },
      select: {
        id: true, institutionName: true, institutionLogo: true,
        lastSyncedAt: true, status: true,
      },
    })

    const snapshots = await db.plaidDataSnapshot.findMany({
      where: { userId: user.id },
      select: { institutionId: true, dataType: true, fetchedAt: true },
    })

    const snapshotMap = new Map<string, Map<string, Date>>()
    for (const s of snapshots) {
      let instMap = snapshotMap.get(s.institutionId)
      if (!instMap) {
        instMap = new Map()
        snapshotMap.set(s.institutionId, instMap)
      }
      instMap.set(s.dataType, s.fetchedAt)
    }

    const result = institutions.map((inst) => {
      const dataTypes = snapshotMap.get(inst.id) ?? new Map()
      return {
        id: inst.id,
        name: inst.institutionName,
        logo: inst.institutionLogo,
        lastSyncedAt: inst.lastSyncedAt,
        dataTypes: {
          item: dataTypes.get("item") ?? null,
          identity: dataTypes.get("identity") ?? null,
          liabilities: dataTypes.get("liabilities") ?? null,
          investments_holdings: dataTypes.get("investments_holdings") ?? null,
          investments_transactions: dataTypes.get("investments_transactions") ?? null,
          recurring: dataTypes.get("recurring") ?? null,
        },
      }
    })

    return NextResponse.json({ institutions: result })
  } catch (err) {
    return apiError("FPS11", "Failed to fetch sync status", 500, err)
  }
}
