import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"

/**
 * GET /api/net-worth
 *
 * Returns combined net worth from both finance (fiat) and portfolio (crypto).
 * Aggregates the latest finance account balances + portfolio snapshot value.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("NW001", "Authentication required", 401)

  try {
    // ─── Finance: live account balances ───
    const financeAccounts = await db.financeAccount.findMany({
      where: { institution: { userId: user.id } },
      select: { type: true, currentBalance: true },
    })

    let fiatCash = 0
    let fiatInvestments = 0
    let fiatDebt = 0

    for (const acct of financeAccounts) {
      const bal = acct.currentBalance ?? 0
      if (acct.type === "checking" || acct.type === "savings") {
        fiatCash += bal
      } else if (acct.type === "investment" || acct.type === "brokerage") {
        fiatInvestments += bal
      } else if (acct.type === "credit" || acct.type === "business_credit") {
        fiatDebt += Math.abs(bal)
      }
    }

    const fiatNetWorth = fiatCash + fiatInvestments - fiatDebt

    // ─── Portfolio: latest snapshot value ───
    const latestSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true, createdAt: true },
    })

    const cryptoValue = latestSnapshot?.totalValue ?? 0

    // ─── Combined ───
    const totalNetWorth = fiatNetWorth + cryptoValue

    // ─── Historical snapshots (last 90 days for sparkline) ───
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [financeSnapshots, portfolioSnapshots] = await Promise.all([
      db.financeSnapshot.findMany({
        where: { userId: user.id, date: { gte: ninetyDaysAgo } },
        orderBy: { date: "asc" },
        select: { date: true, netWorth: true },
      }),
      db.portfolioSnapshot.findMany({
        where: { userId: user.id, createdAt: { gte: ninetyDaysAgo } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, totalValue: true },
      }),
    ])

    // Build a combined daily time series
    const dayMap = new Map<string, { fiat: number; crypto: number }>()

    for (const snap of financeSnapshots) {
      const key = snap.date.toISOString().slice(0, 10)
      const entry = dayMap.get(key) ?? { fiat: 0, crypto: 0 }
      entry.fiat = snap.netWorth
      dayMap.set(key, entry)
    }

    for (const snap of portfolioSnapshots) {
      const key = snap.createdAt.toISOString().slice(0, 10)
      const entry = dayMap.get(key) ?? { fiat: 0, crypto: 0 }
      // Use latest snapshot per day
      entry.crypto = snap.totalValue
      dayMap.set(key, entry)
    }

    // Forward-fill gaps so each day has the latest known value
    const sortedDays = [...dayMap.keys()].sort()
    let lastFiat = 0
    let lastCrypto = 0
    const history: Array<{ date: string; fiat: number; crypto: number; total: number }> = []

    for (const day of sortedDays) {
      const entry = dayMap.get(day)!
      if (entry.fiat !== 0) lastFiat = entry.fiat
      else entry.fiat = lastFiat
      if (entry.crypto !== 0) lastCrypto = entry.crypto
      else entry.crypto = lastCrypto
      history.push({
        date: day,
        fiat: entry.fiat,
        crypto: entry.crypto,
        total: entry.fiat + entry.crypto,
      })
    }

    return NextResponse.json({
      totalNetWorth,
      fiat: {
        cash: fiatCash,
        investments: fiatInvestments,
        debt: fiatDebt,
        netWorth: fiatNetWorth,
      },
      crypto: {
        value: cryptoValue,
        snapshotAt: latestSnapshot?.createdAt ?? null,
      },
      history,
    })
  } catch (error) {
    return apiError("NW002", "Failed to compute net worth", 500, error)
  }
}
