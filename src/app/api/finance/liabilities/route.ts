import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FL010", "Authentication required", 401)

  try {
    const [creditCards, mortgages, studentLoans] = await Promise.all([
      db.financeLiabilityCreditCard.findMany({
        where: { userId: user.id },
      }),
      db.financeLiabilityMortgage.findMany({
        where: { userId: user.id },
      }),
      db.financeLiabilityStudentLoan.findMany({
        where: { userId: user.id },
      }),
    ])

    // Join with accounts for names
    const accountIds = [
      ...creditCards.map((c) => c.accountId),
      ...mortgages.map((m) => m.accountId),
      ...studentLoans.map((s) => s.accountId),
    ]
    const accounts = await db.financeAccount.findMany({
      where: { id: { in: accountIds } },
      select: { id: true, name: true, mask: true, currentBalance: true },
    })
    const accountMap = new Map(accounts.map((a) => [a.id, a]))

    return NextResponse.json({
      creditCards: creditCards.map((c) => ({
        ...c,
        accountName: accountMap.get(c.accountId)?.name ?? null,
        mask: accountMap.get(c.accountId)?.mask ?? null,
        currentBalance: accountMap.get(c.accountId)?.currentBalance ?? null,
      })),
      mortgages: mortgages.map((m) => ({
        ...m,
        accountName: accountMap.get(m.accountId)?.name ?? null,
        mask: accountMap.get(m.accountId)?.mask ?? null,
        currentBalance: accountMap.get(m.accountId)?.currentBalance ?? null,
      })),
      studentLoans: studentLoans.map((s) => ({
        ...s,
        accountName: accountMap.get(s.accountId)?.name ?? null,
        mask: accountMap.get(s.accountId)?.mask ?? null,
        currentBalance: accountMap.get(s.accountId)?.currentBalance ?? null,
      })),
    })
  } catch (err) {
    return apiError("FL011", "Failed to fetch liabilities", 500, err)
  }
}
