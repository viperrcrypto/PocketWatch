import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F6070", "Authentication required", 401)

  try {
    // Fetch all card profiles with reward rates
    const cards = await db.creditCardProfile.findMany({
      where: { userId: user.id },
      include: { rewardRates: true },
    })

    if (cards.length === 0) {
      return NextResponse.json({
        walletStrategy: [],
        totalOptimalRewards: 0,
        totalActualRewards: 0,
        gapAmount: 0,
        pointsValuation: [],
      })
    }

    // Get current month spending by category (using most recent data month)
    const recentMonth = await db.$queryRaw<Array<{ month: string }>>`
      SELECT DISTINCT TO_CHAR(date, 'YYYY-MM') AS month
      FROM "FinanceTransaction"
      WHERE "userId" = ${user.id} AND "isDuplicate" = false AND "isExcluded" = false
      ORDER BY month DESC LIMIT 1
    `

    const monthStr = recentMonth[0]?.month
    const categorySpending = new Map<string, number>()

    if (monthStr) {
      const startDate = new Date(`${monthStr}-01`)
      const parts = monthStr.split("-")
      const endDate = new Date(Number(parts[0]), Number(parts[1]), 1)

      const txGroups = await db.financeTransaction.groupBy({
        by: ["category"],
        where: {
          userId: user.id,
          isDuplicate: false,
          isExcluded: false,
          amount: { gt: 0 },
          date: { gte: startDate, lt: endDate },
        },
        _sum: { amount: true },
      })

      for (const g of txGroups) {
        if (g.category) {
          categorySpending.set(g.category, g._sum.amount ?? 0)
        }
      }
    }

    // Build wallet strategy: for each category, find the best card
    const walletStrategy: Array<{
      category: string
      bestCard: string
      bestRate: number
      monthlySpend: number
      monthlyReward: number
    }> = []

    for (const [category, monthlySpend] of categorySpending) {
      let bestCard = ""
      let bestRate = 0

      for (const card of cards) {
        // Check explicit reward rates first
        const explicitRate = card.rewardRates.find((r) => r.spendingCategory === category)
        const rate = explicitRate?.rewardRate ?? card.baseRewardRate

        if (rate > bestRate) {
          bestRate = rate
          bestCard = card.cardName
        }
      }

      if (bestCard && monthlySpend > 0) {
        walletStrategy.push({
          category,
          bestCard,
          bestRate,
          monthlySpend: round(monthlySpend),
          monthlyReward: round(monthlySpend * (bestRate / 100)),
        })
      }
    }

    walletStrategy.sort((a, b) => b.monthlyReward - a.monthlyReward)

    const totalOptimalRewards = walletStrategy.reduce((s, w) => s + w.monthlyReward, 0)

    // Actual rewards: if user uses default card for everything
    const defaultRate = cards.reduce((best, c) => Math.max(best, c.baseRewardRate), 0)
    const totalSpending = [...categorySpending.values()].reduce((s, v) => s + v, 0)
    const totalActualRewards = round(totalSpending * (defaultRate / 100))
    const gapAmount = round(totalOptimalRewards - totalActualRewards)

    // Points valuation per program
    const programMap = new Map<string, { balance: number; valuePerPoint: number }>()
    for (const card of cards) {
      const program = card.rewardProgram ?? card.cardName
      const balance = card.pointsBalance ?? card.cashbackBalance ?? 0
      const vpp = card.rewardType === "cashback" ? 100 : (card.pointValue ?? 1)
      const existing = programMap.get(program)
      if (existing) {
        existing.balance += balance
      } else {
        programMap.set(program, { balance, valuePerPoint: vpp })
      }
    }

    const pointsValuation = [...programMap.entries()].map(([program, data]) => ({
      program,
      balance: data.balance,
      valuePerPoint: data.valuePerPoint,
      totalValue: round(data.balance * (data.valuePerPoint / 100)),
    }))

    return NextResponse.json({
      walletStrategy,
      totalOptimalRewards: round(totalOptimalRewards),
      totalActualRewards,
      gapAmount,
      pointsValuation,
    })
  } catch (err) {
    return apiError("F6071", "Failed to compute card strategy", 500, err)
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
