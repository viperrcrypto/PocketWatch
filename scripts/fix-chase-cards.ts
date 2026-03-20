/**
 * Script to fix credit cards misclassified as checking by SimpleFIN.
 * SimpleFIN reports some cards under cardholder names instead of card product names.
 * Run after every SimpleFIN reconnection: npx tsx scripts/fix-chase-cards.ts
 */
import "dotenv/config"
import { PrismaClient } from "../src/generated/prisma/client.js"
import { PrismaPg } from "@prisma/adapter-pg"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

const CHASE_CARD_FIXES = [
  { mask: "3095", cardName: "Chase Ink Unlimited (3095)", cardNetwork: "visa", annualFee: 0 },
  { mask: "6441", cardName: "Chase Ink Preferred (6441)", cardNetwork: "visa", annualFee: 95 },
  { mask: "9733", cardName: "Chase Ink Unlimited (9733)", cardNetwork: "visa", annualFee: 0 },
  { mask: "5592", cardName: "Chase Ink Unlimited (5592)", cardNetwork: "visa", annualFee: 0 },
  { mask: "9522", cardName: "Chase Ink Business Cash (9522)", cardNetwork: "visa", annualFee: 0 },
]

// Other cards misclassified by SimpleFIN as checking
const OTHER_CARD_FIXES = [
  { mask: "6316", institution: "Citi", cardName: "Citi Strata Premier (6316)", cardNetwork: "mastercard", annualFee: 95, rewardType: "points" as const, rewardProgram: "ThankYou Points" },
  { mask: "8534", institution: "BILT Rewards", cardName: "Bilt Palladium Card (8534)", cardNetwork: "mastercard", annualFee: 0, rewardType: "points" as const, rewardProgram: "Bilt Rewards" },
]

// Name-based fixes (no mask available, match by cardholder name)
const NAME_BASED_FIXES = [
  { currentName: "Dalia", institution: "Apple Card", cardName: "Apple Card", cardNetwork: "mastercard", annualFee: 0, rewardType: "cashback" as const, rewardProgram: "Daily Cash" },
]

// Payment due days from user's actual statements
const DUE_DAYS: Record<string, number> = {
  "9049": 22,  // Chase Sapphire Reserve
  "3095": 7,   // Ink Unlimited
  "6441": 23,  // Ink Preferred
  "9733": 21,  // Ink Unlimited
  "5592": 17,  // Ink Unlimited
  "9522": 18,  // Ink Business Cash
  "1037": 15,  // Citi AAdvantage
  "6316": 15,  // Citi Strata Premier
  "3067": 25,  // HSBC Premier World Mastercard
  "1632": 25,  // Prime Store Card
}

async function main() {
  const user = await db.user.findFirst()
  if (!user) { console.error("No user found"); return }

  for (const fix of CHASE_CARD_FIXES) {
    const account = await db.financeAccount.findFirst({
      where: { userId: user.id, mask: fix.mask, institution: { institutionName: "Chase Bank" } },
    })
    if (!account) { console.log(`  skip: no account with mask ${fix.mask}`); continue }

    // Update account type and name
    await db.financeAccount.update({
      where: { id: account.id },
      data: { type: "credit", name: fix.cardName },
    })

    // Create card profile if missing
    const existing = await db.creditCardProfile.findFirst({ where: { accountId: account.id } })
    if (!existing) {
      await db.creditCardProfile.create({
        data: {
          userId: user.id,
          accountId: account.id,
          cardName: fix.cardName,
          cardNetwork: fix.cardNetwork,
          rewardType: "points",
          rewardProgram: "Chase Ultimate Rewards",
          baseRewardRate: 1,
          annualFee: fix.annualFee,
          bonusCategories: [],
        },
      })
      console.log(`  created: ${fix.cardName}`)
    } else {
      await db.creditCardProfile.update({
        where: { id: existing.id },
        data: { cardName: fix.cardName, annualFee: fix.annualFee },
      })
      console.log(`  updated: ${fix.cardName}`)
    }
  }

  // Fix Citi Strata and other non-Chase misclassified cards
  for (const fix of OTHER_CARD_FIXES) {
    const account = await db.financeAccount.findFirst({
      where: { userId: user.id, mask: fix.mask },
    })
    if (!account) { console.log(`  skip: no account with mask ${fix.mask}`); continue }

    await db.financeAccount.update({
      where: { id: account.id },
      data: { type: "credit", name: fix.cardName },
    })

    const existing = await db.creditCardProfile.findFirst({ where: { accountId: account.id } })
    if (!existing) {
      await db.creditCardProfile.create({
        data: {
          userId: user.id, accountId: account.id,
          cardName: fix.cardName, cardNetwork: fix.cardNetwork,
          rewardType: fix.rewardType, rewardProgram: fix.rewardProgram,
          baseRewardRate: 1, annualFee: fix.annualFee, bonusCategories: [],
        },
      })
      console.log(`  created: ${fix.cardName}`)
    } else {
      console.log(`  exists: ${fix.cardName}`)
    }
  }

  // Fix name-based misclassified cards (e.g. Apple Card showing as "Dalia")
  for (const fix of NAME_BASED_FIXES) {
    const account = await db.financeAccount.findFirst({
      where: { userId: user.id, name: fix.currentName, institution: { institutionName: { contains: fix.institution } } },
    })
    if (!account) { console.log(`  skip: no account named "${fix.currentName}"`); continue }

    await db.financeAccount.update({
      where: { id: account.id },
      data: { type: "credit", name: fix.cardName },
    })

    const existing = await db.creditCardProfile.findFirst({ where: { accountId: account.id } })
    if (!existing) {
      await db.creditCardProfile.create({
        data: {
          userId: user.id, accountId: account.id,
          cardName: fix.cardName, cardNetwork: fix.cardNetwork,
          rewardType: fix.rewardType, rewardProgram: fix.rewardProgram,
          baseRewardRate: 1, annualFee: fix.annualFee, bonusCategories: [],
        },
      })
      console.log(`  created: ${fix.cardName}`)
    } else {
      await db.creditCardProfile.update({
        where: { id: existing.id },
        data: { cardName: fix.cardName },
      })
      console.log(`  updated: ${fix.cardName}`)
    }
  }

  // Set payment due days
  for (const [mask, dueDay] of Object.entries(DUE_DAYS)) {
    const account = await db.financeAccount.findFirst({
      where: { userId: user.id, mask },
    })
    if (!account) continue
    const profile = await db.creditCardProfile.findFirst({ where: { accountId: account.id } })
    if (!profile) continue
    await db.creditCardProfile.update({
      where: { id: profile.id },
      data: { paymentDueDay: dueDay },
    })
    console.log(`  due day: ${profile.cardName} → ${dueDay}th`)
  }

  console.log("Done!")
  await db.$disconnect()
}

main().catch(console.error)
