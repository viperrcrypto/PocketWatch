import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FIH10", "Authentication required", 401)

  try {
    const [holdings, securities] = await Promise.all([
      db.financeInvestmentHolding.findMany({ where: { userId: user.id } }),
      db.financeInvestmentSecurity.findMany({ where: { userId: user.id } }),
    ])

    const securityMap = new Map(securities.map((s) => [s.securityId, s]))
    const accounts = await db.financeAccount.findMany({
      where: { id: { in: [...new Set(holdings.map((h) => h.accountId))] } },
      select: { id: true, name: true, mask: true },
    })
    const accountMap = new Map(accounts.map((a) => [a.id, a]))

    const enriched = holdings.map((h) => ({
      ...h,
      security: securityMap.get(h.securityId ?? "") ?? null,
      accountName: accountMap.get(h.accountId)?.name ?? null,
      accountMask: accountMap.get(h.accountId)?.mask ?? null,
    }))

    const totalValue = holdings.reduce((sum, h) => sum + (h.institutionValue ?? 0), 0)

    return NextResponse.json({ holdings: enriched, securities, totalValue })
  } catch (err) {
    return apiError("FIH11", "Failed to fetch holdings", 500, err)
  }
}
