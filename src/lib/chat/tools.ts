/**
 * PocketLLM tool executors — 8 read-only Prisma queries scoped to the user.
 * Server-only. Tool schemas are in tool-definitions.ts.
 */

import { db } from "@/lib/db"

type ToolInput = Record<string, unknown>

export async function executeTool(name: string, input: ToolInput, userId: string): Promise<string> {
  switch (name) {
    case "get_account_balances":
      return getAccountBalances(userId)
    case "get_spending_summary":
      return getSpendingSummary(userId, input)
    case "get_transactions":
      return getTransactions(userId, input)
    case "get_budget_status":
      return getBudgetStatus(userId)
    case "get_subscriptions":
      return getSubscriptions(userId, input)
    case "get_net_worth":
      return getNetWorth(userId)
    case "get_investments":
      return getInvestments(userId)
    case "get_credit_cards":
      return getCreditCards(userId)
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` })
  }
}

async function getAccountBalances(userId: string): Promise<string> {
  const accounts = await db.financeAccount.findMany({
    where: { userId, isHidden: false },
    select: {
      name: true,
      type: true,
      subtype: true,
      currentBalance: true,
      availableBalance: true,
      creditLimit: true,
      currency: true,
      institution: { select: { institutionName: true } },
    },
    orderBy: { institution: { institutionName: "asc" } },
  })

  return JSON.stringify(
    accounts.map((a) => ({
      name: a.name,
      institution: a.institution.institutionName,
      type: a.type,
      subtype: a.subtype,
      currentBalance: a.currentBalance,
      availableBalance: a.availableBalance,
      creditLimit: a.creditLimit,
      currency: a.currency,
    }))
  )
}

async function getSpendingSummary(userId: string, input: ToolInput): Promise<string> {
  const now = new Date()
  const startDate = input.startDate
    ? new Date(input.startDate as string)
    : new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = input.endDate
    ? new Date(input.endDate as string)
    : now

  const spending = await db.financeTransaction.groupBy({
    by: ["category"],
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
      amount: { gt: 0 },
      isExcluded: false,
      isDuplicate: false,
    },
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: "desc" } },
  })

  const total = spending.reduce((sum, s) => sum + (s._sum.amount ?? 0), 0)

  return JSON.stringify({
    period: { start: startDate.toISOString().split("T")[0], end: endDate.toISOString().split("T")[0] },
    totalSpent: Math.round(total * 100) / 100,
    categories: spending.map((s) => ({
      category: s.category ?? "Uncategorized",
      amount: Math.round((s._sum.amount ?? 0) * 100) / 100,
      count: s._count,
    })),
  })
}

async function getTransactions(userId: string, input: ToolInput): Promise<string> {
  const limit = Math.min((input.limit as number) || 20, 50)
  const where: Record<string, unknown> = {
    userId,
    isExcluded: false,
    isDuplicate: false,
  }

  if (input.search) {
    where.OR = [
      { name: { contains: input.search as string, mode: "insensitive" } },
      { merchantName: { contains: input.search as string, mode: "insensitive" } },
    ]
  }
  if (input.category) {
    where.category = { equals: input.category as string, mode: "insensitive" }
  }
  if (input.startDate || input.endDate) {
    const dateFilter: Record<string, Date> = {}
    if (input.startDate) dateFilter.gte = new Date(input.startDate as string)
    if (input.endDate) dateFilter.lte = new Date(input.endDate as string)
    where.date = dateFilter
  }

  const txs = await db.financeTransaction.findMany({
    where,
    select: {
      date: true,
      name: true,
      merchantName: true,
      amount: true,
      category: true,
      account: { select: { name: true } },
    },
    orderBy: { date: "desc" },
    take: limit,
  })

  return JSON.stringify(
    txs.map((t) => ({
      date: (t.date as Date).toISOString().split("T")[0],
      description: t.merchantName || t.name,
      amount: t.amount,
      category: t.category,
      account: t.account.name,
    }))
  )
}

async function getBudgetStatus(userId: string): Promise<string> {
  const budgets = await db.financeBudget.findMany({
    where: { userId, isActive: true },
    orderBy: { category: "asc" },
  })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)

  const spending = await db.financeTransaction.groupBy({
    by: ["category"],
    where: {
      userId,
      date: { gte: monthStart, lte: monthEnd },
      amount: { gt: 0 },
      isExcluded: false,
      isDuplicate: false,
    },
    _sum: { amount: true },
  })

  const spendingMap = new Map(spending.map((s) => [s.category, s._sum.amount ?? 0]))

  return JSON.stringify(
    budgets.map((b) => {
      const spent = spendingMap.get(b.category) ?? 0
      return {
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        spent: Math.round(spent * 100) / 100,
        remaining: Math.round((b.monthlyLimit - spent) * 100) / 100,
        percentUsed: b.monthlyLimit > 0 ? Math.round((spent / b.monthlyLimit) * 1000) / 10 : 0,
      }
    })
  )
}

async function getSubscriptions(userId: string, input: ToolInput): Promise<string> {
  const includeInactive = (input.includeInactive as boolean) ?? false
  const where: Record<string, unknown> = { userId }
  if (!includeInactive) where.status = "active"

  const subs = await db.financeSubscription.findMany({
    where,
    select: {
      merchantName: true,
      nickname: true,
      amount: true,
      frequency: true,
      category: true,
      status: true,
      lastChargeDate: true,
      nextChargeDate: true,
    },
    orderBy: { amount: "desc" },
  })

  return JSON.stringify(
    subs.map((s) => ({
      name: s.nickname || s.merchantName,
      amount: s.amount,
      frequency: s.frequency,
      category: s.category,
      status: s.status,
      lastCharge: s.lastChargeDate ? (s.lastChargeDate as Date).toISOString().split("T")[0] : null,
      nextCharge: s.nextChargeDate ? (s.nextChargeDate as Date).toISOString().split("T")[0] : null,
    }))
  )
}

async function getNetWorth(userId: string): Promise<string> {
  const snapshot = await db.financeSnapshot.findFirst({
    where: { userId },
    orderBy: { date: "desc" },
    select: {
      date: true,
      totalAssets: true,
      totalDebt: true,
      netWorth: true,
      breakdown: true,
    },
  })

  if (!snapshot) return JSON.stringify({ error: "No net worth snapshots found." })

  let breakdown: unknown = null
  try {
    breakdown = JSON.parse(snapshot.breakdown)
  } catch { /* stored as string */ }

  return JSON.stringify({
    date: (snapshot.date as Date).toISOString().split("T")[0],
    totalAssets: snapshot.totalAssets,
    totalDebt: snapshot.totalDebt,
    netWorth: snapshot.netWorth,
    breakdown,
  })
}

async function getInvestments(userId: string): Promise<string> {
  const holdings = await db.financeInvestmentHolding.findMany({
    where: { userId },
    select: {
      quantity: true,
      costBasis: true,
      institutionPrice: true,
      institutionValue: true,
      securityId: true,
      account: { select: { name: true } },
    },
  })

  const securityIds = holdings.map((h) => h.securityId).filter(Boolean) as string[]
  const securities = securityIds.length > 0
    ? await db.financeInvestmentSecurity.findMany({
        where: { userId, securityId: { in: securityIds } },
        select: { securityId: true, name: true, tickerSymbol: true, type: true },
      })
    : []
  const secMap = new Map(securities.map((s) => [s.securityId, s]))

  return JSON.stringify(
    holdings.map((h) => {
      const sec = h.securityId ? secMap.get(h.securityId) : null
      return {
        name: sec?.name ?? "Unknown",
        ticker: sec?.tickerSymbol ?? null,
        type: sec?.type ?? null,
        account: h.account.name,
        quantity: h.quantity,
        price: h.institutionPrice,
        value: h.institutionValue,
        costBasis: h.costBasis,
      }
    })
  )
}

async function getCreditCards(userId: string): Promise<string> {
  const cards = await db.creditCardProfile.findMany({
    where: { userId },
    select: {
      cardName: true,
      cardNetwork: true,
      annualFee: true,
      rewardType: true,
      rewardProgram: true,
      pointsBalance: true,
      cashbackBalance: true,
      baseRewardRate: true,
      bonusCategories: true,
    },
    orderBy: { cardName: "asc" },
  })

  return JSON.stringify(
    cards.map((c) => ({
      name: c.cardName,
      network: c.cardNetwork,
      annualFee: c.annualFee,
      rewardType: c.rewardType,
      rewardProgram: c.rewardProgram,
      pointsBalance: c.pointsBalance,
      cashbackBalance: c.cashbackBalance,
      baseRewardRate: c.baseRewardRate,
      bonusCategories: c.bonusCategories,
    }))
  )
}
