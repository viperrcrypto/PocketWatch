import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

interface BonusCategory {
  category: string
  rate: number
  rotating?: boolean
  activationRequired?: boolean
  quarter?: number
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F7020", "Authentication required", 401)

  try {
    const cards = await db.creditCardProfile.findMany({
      where: { userId: user.id },
    })

    if (cards.length === 0) {
      return NextResponse.json({ recommendations: [] })
    }

    // Get last 30 days of spending by category
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const spending = await db.financeTransaction.groupBy({
      by: ["category"],
      where: {
        userId: user.id,
        date: { gte: thirtyDaysAgo },
        amount: { gt: 0 },
        isDuplicate: false,
        isExcluded: false,
      },
      _sum: { amount: true },
    })

    const recommendations = spending
      .filter((s) => s.category && s._sum.amount)
      .map((s) => {
        const category = s.category!
        const amount = s._sum.amount!

        // Find best card for this category
        let bestCard = cards[0]
        let bestRate = cards[0].baseRewardRate

        for (const card of cards) {
          const bonuses = card.bonusCategories as BonusCategory[] | null
          const bonusMatch = bonuses?.find(
            (b) => b.category.toLowerCase() === category.toLowerCase()
          )
          const effectiveRate = bonusMatch ? bonusMatch.rate : card.baseRewardRate

          if (effectiveRate > bestRate) {
            bestRate = effectiveRate
            bestCard = card
          }
        }

        return {
          category,
          monthlySpend: Math.round(amount * 100) / 100,
          bestCard: bestCard.cardName,
          bestRate,
          monthlyReward: Math.round(amount * bestRate * 100) / 10000,
        }
      })
      .sort((a, b) => b.monthlySpend - a.monthlySpend)

    const totalOptimalRewards = recommendations.reduce(
      (sum, r) => sum + r.monthlyReward, 0
    )

    return NextResponse.json({
      recommendations,
      totalOptimalRewards: Math.round(totalOptimalRewards * 100) / 100,
    })
  } catch (err) {
    return apiError("F7021", "Failed to generate recommendations", 500, err)
  }
}
