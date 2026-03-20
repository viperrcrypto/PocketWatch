import { getCurrentUser, withUserEncryption } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { mapFinanceError } from "@/lib/finance/error-map"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

/** Rewards program names that Plaid sometimes returns as card names */
const REWARDS_PROGRAM_NAMES = [
  "ultimate rewards", "membership rewards", "thankyou points",
  "thank you points", "cashback rewards", "cash back rewards",
  "venture rewards", "miles rewards",
]

/** Detect stored card names that are actually cardholder names, generic labels, or rewards programs */
function isBadCardName(name: string): boolean {
  if (/^credit\s*card$/i.test(name.trim())) return true
  const n = name.trim()
  // Rewards program names (e.g. "Ultimate Rewards®")
  const cleaned = n.replace(/[®™©]/g, "").trim().toLowerCase()
  if (REWARDS_PROGRAM_NAMES.some((rp) => cleaned === rp || cleaned.startsWith(rp))) return true
  if (n.length > 25) return false
  // "Z. KAL", "J SMITH", "CF FROST"
  if (/^[A-Z]{1,3}[.\s]/.test(n)) return true
  // "JOHN DOE" (all caps, 2-3 words, no card keywords)
  const cardKeywords = /card|cash|reward|freedom|sapphire|platinum|gold|venture|discover|preferred|everyday|business|unlimited|flex/i
  if (/^[A-Z]+\s[A-Z]+$/.test(n) && !cardKeywords.test(n)) return true
  return false
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F7001", "Authentication required", 401)

  return withUserEncryption(async () => {
  try {
    const cards = await db.creditCardProfile.findMany({
      where: { userId: user.id },
      orderBy: { cardName: "asc" },
    })

    // Fetch linked accounts for name cleanup
    const accountIds = cards.map((c) => c.accountId)
    const accounts = accountIds.length > 0
      ? await db.financeAccount.findMany({
          where: { id: { in: accountIds } },
          select: { id: true, name: true, mask: true, institution: { select: { institutionName: true } } },
        })
      : []
    const acctMap = new Map(accounts.map((a) => [a.id, a]))

    // Fix bad card names in the DB (one-time cleanup per card)
    const updates: Promise<unknown>[] = []
    const result = cards.map((c) => {
      if (!isBadCardName(c.cardName)) return c

      const acct = acctMap.get(c.accountId)
      if (!acct) return c

      const inst = acct.institution?.institutionName ?? ""
      // Try account name, then fallback to institution + mask
      let newName = acct.name?.trim() ?? ""
      if (!newName || isBadCardName(newName)) {
        newName = `${inst} Card${acct.mask ? ` ••••${acct.mask}` : ""}`
      }
      if (newName !== c.cardName) {
        updates.push(db.creditCardProfile.update({ where: { id: c.id }, data: { cardName: newName } }))
        return { ...c, cardName: newName }
      }
      return c
    })

    // Fire updates in background — don't block the response
    if (updates.length > 0) {
      Promise.all(updates).catch(() => { /* best-effort cleanup */ })
    }

    // Background: sync known card images to DB (backfill missing + fix stale)
    {
      const { getKnownCardImage, isInKnownCardsMap } = await import("@/components/finance/card-image-map")
      const imageUpdates = result.flatMap((card) => {
        const inst = acctMap.get(card.accountId)?.institution?.institutionName
        const knownImage = getKnownCardImage(card.cardName, inst)
        if (knownImage && card.cardImageUrl !== knownImage) {
          return db.creditCardProfile.update({
            where: { id: card.id },
            data: { cardImageUrl: knownImage },
          })
        }
        // Clear stale URLs for cards in the known map that have no valid image
        if (!knownImage && card.cardImageUrl && isInKnownCardsMap(card.cardName, inst)) {
          return db.creditCardProfile.update({
            where: { id: card.id },
            data: { cardImageUrl: null },
          })
        }
        return []
      })
      if (imageUpdates.length > 0) {
        Promise.all(imageUpdates).catch(() => { /* best-effort image sync */ })
      }
    }

    // Background: detect annual fee dates from transaction history
    const noFeeDate = result.filter((c) => !c.annualFeeDate)
    if (noFeeDate.length > 0) {
      const feePatterns = [
        "ANNUAL MEMBERSHIP FEE", "ANNUAL FEE", "CARD MEMBER FEE",
        "CARDMEMBER FEE", "AF CHARGE", "ANNUAL CARD FEE",
      ]
      db.financeTransaction.findMany({
        where: {
          userId: user.id,
          accountId: { in: noFeeDate.map((c) => c.accountId) },
          OR: feePatterns.map((p) => ({ name: { contains: p, mode: "insensitive" as const } })),
        },
        select: { accountId: true, date: true },
        orderBy: { date: "desc" },
      }).then((feeTxs) => {
        return Promise.all(noFeeDate.flatMap((card) => {
          const match = feeTxs.find((t) => t.accountId === card.accountId)
          if (!match) return []
          const nextFeeDate = new Date(match.date)
          nextFeeDate.setFullYear(nextFeeDate.getFullYear() + 1)
          return db.creditCardProfile.update({
            where: { id: card.id },
            data: { annualFeeDate: nextFeeDate },
          })
        }))
      }).catch(() => { /* best-effort fee date detection */ })
    }

    return NextResponse.json(result)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch card profiles")
    return apiError("F7002", mapped.message, mapped.status, err)
  }
  }) // withUserEncryption
}

const cardSchema = z.object({
  accountId: z.string().min(1),
  cardNetwork: z.enum(["visa", "mastercard", "amex", "discover"]),
  cardName: z.string().min(1).max(200),
  annualFee: z.number().min(0).optional(),
  rewardType: z.enum(["cashback", "points", "miles"]),
  baseRewardRate: z.number().min(0).optional(),
  bonusCategories: z.array(z.object({
    category: z.string(),
    rate: z.number(),
    rotating: z.boolean().optional(),
    activationRequired: z.boolean().optional(),
    quarter: z.number().optional(),
  })).max(20).optional(),
  statementCredits: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    frequency: z.string(),
    used: z.boolean().optional(),
  })).max(20).optional(),
  rewardProgram: z.string().optional(),
  annualFeeDate: z.string().datetime().optional(),
  paymentDueDay: z.number().int().min(1).max(31).optional(),
  transferPartners: z.array(z.object({
    name: z.string(),
    ratio: z.string().optional(),
    shortCode: z.string().optional(),
  })).max(30).optional(),
  pointsBalance: z.number().optional(),
  pointValue: z.number().optional(),
  cashbackBalance: z.number().optional(),
  totalEarned: z.number().optional(),
  totalRedeemed: z.number().optional(),
  cardImageUrl: z.string().url().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F7010", "Authentication required", 401)

  const body = await req.json()
  const parsed = cardSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F7011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { accountId, bonusCategories, statementCredits, transferPartners, ...rest } = parsed.data

  // Verify the account belongs to this user
  const account = await db.financeAccount.findFirst({
    where: { id: accountId, institution: { userId: user.id } },
  })
  if (!account) {
    return apiError("F7013", "Account not found or not owned by you", 404)
  }

  const data = {
    ...rest,
    annualFee: rest.annualFee ?? 0,
    annualFeeDate: rest.annualFeeDate ? new Date(rest.annualFeeDate) : undefined,
    baseRewardRate: rest.baseRewardRate ?? 1,
    bonusCategories: bonusCategories ?? [],
    statementCredits: statementCredits ?? undefined,
    transferPartners: transferPartners ?? undefined,
    rewardProgram: rest.rewardProgram ?? null,
    pointsBalance: rest.pointsBalance ?? null,
    pointValue: rest.pointValue ?? null,
    cashbackBalance: rest.cashbackBalance ?? null,
    totalEarned: rest.totalEarned ?? 0,
    totalRedeemed: rest.totalRedeemed ?? 0,
  }

  try {
    const card = await db.creditCardProfile.upsert({
      where: { userId_accountId: { userId: user.id, accountId } },
      create: { userId: user.id, accountId, ...data },
      update: data,
    })

    return NextResponse.json(card)
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to save card profile")
    return apiError("F7012", mapped.message, mapped.status, err)
  }
}
