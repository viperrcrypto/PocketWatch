/**
 * Supplemental demo data — subscriptions, Amex card, recurring streams.
 * Run: npx tsx scripts/seed-demo-extras.ts
 */

import "dotenv/config"
import { db } from "../src/lib/db"
import { withEncryptionKey } from "../src/lib/encryption-context"
import { unwrapDek } from "../src/lib/per-user-crypto"

// Provide via env — never hardcode a real user id / wrapped DEK in tracked code.
const USER_ID = process.env.DEMO_USER_ID ?? ""
const ENCRYPTED_DEK = process.env.DEMO_ENCRYPTED_DEK ?? ""
if (!USER_ID || !ENCRYPTED_DEK) {
  throw new Error("Set DEMO_USER_ID and DEMO_ENCRYPTED_DEK in .env to run the demo seeder.")
}

function dateAt(y: number, m: number, d: number): Date {
  return new Date(y, m - 1, d)
}

async function main() {
  const dekHex = await unwrapDek(ENCRYPTED_DEK)
  await withEncryptionKey(dekHex, async () => {
    await seedAmexCard()
    await seedSubscriptions()
    await seedRecurringStreams()
  })
  console.log("✅ Extra demo data seeded!")
  process.exit(0)
}

// ── Amex Platinum ────────────────────────────────────────────────────────────

async function seedAmexCard() {
  // Check if Amex institution exists
  let amexInst = await db.financeInstitution.findFirst({
    where: { userId: USER_ID, institutionName: "American Express" },
  })
  if (!amexInst) {
    amexInst = await db.financeInstitution.create({
      data: {
        userId: USER_ID,
        provider: "manual",
        institutionName: "American Express",
        institutionLogo: "https://logo.clearbit.com/americanexpress.com",
        status: "active",
        lastSyncedAt: new Date(),
      },
    })
    console.log("💳 Created Amex institution")
  }

  // Amex Platinum account
  const amexAccount = await db.financeAccount.upsert({
    where: { userId_externalId: { userId: USER_ID, externalId: "demo-amex-platinum-001" } },
    update: {},
    create: {
      userId: USER_ID,
      institutionId: amexInst.id,
      externalId: "demo-amex-platinum-001",
      name: "Amex Platinum Card",
      officialName: "The Platinum Card from American Express",
      type: "credit",
      subtype: "credit card",
      mask: "1008",
      currentBalance: -2450,
      availableBalance: 0,
      creditLimit: 0, // charge card — no preset limit
      currency: "USD",
    },
  })

  // Profile
  const existingProfile = await db.creditCardProfile.findUnique({
    where: { userId_accountId: { userId: USER_ID, accountId: amexAccount.id } },
  })
  if (existingProfile) {
    console.log("  ↳ Amex Platinum profile already exists")
    return
  }

  const profile = await db.creditCardProfile.create({
    data: {
      userId: USER_ID,
      accountId: amexAccount.id,
      cardNetwork: "amex",
      cardName: "The Platinum Card",
      annualFee: 695,
      rewardType: "points",
      rewardProgram: "Amex Membership Rewards",
      pointsBalance: 287300,
      pointValue: 0.02,
      cashbackBalance: null,
      totalEarned: 8400,
      totalRedeemed: 4200,
      baseRewardRate: 1,
      bonusCategories: [
        { category: "Flights (directly with airlines)", rate: 5, unit: "points" },
        { category: "Hotels (amextravel.com)", rate: 5, unit: "points" },
      ],
      statementCredits: [
        { name: "$200 Hotel Credit", value: 200, used: 150 },
        { name: "$200 Airline Fee Credit", value: 200, used: 200 },
        { name: "$240 Digital Entertainment", value: 240, used: 180 },
        { name: "$200 Uber Cash", value: 200, used: 135 },
        { name: "$155 Walmart+ Credit", value: 155, used: 0 },
        { name: "$100 Saks Credit", value: 100, used: 50 },
      ],
      annualFeeDate: dateAt(2026, 11, 1),
      transferPartners: [
        "Delta SkyMiles", "ANA Mileage Club", "Singapore KrisFlyer",
        "Hilton Honors", "Marriott Bonvoy", "British Airways Avios",
      ],
      cardImageUrl: null,
    },
  })

  // Perks
  const perks = [
    { name: "$200 Airline Fee Credit", value: 200, isUsed: true },
    { name: "$200 Hotel Credit (AmexTravel)", value: 200, isUsed: false },
    { name: "$240 Digital Entertainment Credit", value: 240, isUsed: true },
    { name: "$200 Uber Cash ($15/mo + $20 Dec)", value: 200, isUsed: false },
    { name: "$155 Walmart+ Credit", value: 155, isUsed: false },
    { name: "$100 Saks Fifth Avenue Credit", value: 100, isUsed: true },
    { name: "$189 CLEAR Plus Credit", value: 189, isUsed: false },
    { name: "Centurion Lounge Access", value: 0, isUsed: false },
    { name: "Priority Pass Select", value: 0, isUsed: false },
    { name: "Global Entry / TSA PreCheck Credit", value: 100, isUsed: true },
    { name: "Trip Cancellation Insurance", value: 0, isUsed: false },
    { name: "Return Protection", value: 0, isUsed: false },
    { name: "Purchase Protection", value: 0, isUsed: false },
    { name: "Extended Warranty", value: 0, isUsed: false },
    { name: "Car Rental Loss & Damage Insurance", value: 0, isUsed: false },
    { name: "Fine Hotels & Resorts Access", value: 0, isUsed: false },
  ]

  for (const p of perks) {
    await db.creditCardPerk.create({
      data: { cardProfileId: profile.id, name: p.name, value: p.value, isUsed: p.isUsed },
    })
  }

  // Reward rates
  const rates = [
    { category: "Flights (direct)", rate: 5 },
    { category: "Hotels (AmexTravel)", rate: 5 },
    { category: "Restaurants", rate: 1 },
    { category: "Travel", rate: 1 },
    { category: "Groceries", rate: 1 },
    { category: "Gas", rate: 1 },
  ]
  for (const r of rates) {
    await db.creditCardRewardRate.upsert({
      where: { cardProfileId_spendingCategory: { cardProfileId: profile.id, spendingCategory: r.category } },
      update: {},
      create: { cardProfileId: profile.id, spendingCategory: r.category, rewardRate: r.rate, rewardType: "points" },
    })
  }

  // Amex transactions
  const txns = [
    { date: dateAt(2025, 12, 5),  name: "Delta Airlines — SFO to JFK",    amount: 485,  category: "Travel",          merchant: "Delta" },
    { date: dateAt(2025, 12, 8),  name: "Uber",                            amount: 32,   category: "Transportation",  merchant: "Uber" },
    { date: dateAt(2025, 12, 12), name: "Netflix",                         amount: 22.99,category: "Entertainment",   merchant: "Netflix" },
    { date: dateAt(2025, 12, 14), name: "Spotify Premium",                 amount: 10.99,category: "Entertainment",   merchant: "Spotify" },
    { date: dateAt(2025, 12, 18), name: "The Ritz-Carlton Half Moon Bay",  amount: 980,  category: "Travel",          merchant: "Ritz-Carlton" },
    { date: dateAt(2025, 12, 20), name: "Saks Fifth Avenue",               amount: 450,  category: "Shopping",        merchant: "Saks" },
    { date: dateAt(2025, 12, 22), name: "Uber Eats",                       amount: 45,   category: "Food & Dining",   merchant: "Uber Eats" },
    { date: dateAt(2026, 1, 3),   name: "Delta Airlines — JFK to LAX",     amount: 520,  category: "Travel",          merchant: "Delta" },
    { date: dateAt(2026, 1, 5),   name: "Uber",                            amount: 28,   category: "Transportation",  merchant: "Uber" },
    { date: dateAt(2026, 1, 8),   name: "Four Seasons Maui",               amount: 1450, category: "Travel",          merchant: "Four Seasons" },
    { date: dateAt(2026, 1, 12),  name: "Netflix",                         amount: 22.99,category: "Entertainment",   merchant: "Netflix" },
    { date: dateAt(2026, 1, 14),  name: "Spotify Premium",                 amount: 10.99,category: "Entertainment",   merchant: "Spotify" },
    { date: dateAt(2026, 1, 20),  name: "Saks Fifth Avenue",               amount: 320,  category: "Shopping",        merchant: "Saks" },
    { date: dateAt(2026, 1, 25),  name: "Uber",                            amount: 41,   category: "Transportation",  merchant: "Uber" },
    { date: dateAt(2026, 2, 1),   name: "Uber Cash",                       amount: -15,  category: "Credits",         merchant: "Uber" },
    { date: dateAt(2026, 2, 3),   name: "Delta Airlines — SFO to SEA",     amount: 285,  category: "Travel",          merchant: "Delta" },
    { date: dateAt(2026, 2, 5),   name: "W Hotel Seattle",                 amount: 620,  category: "Travel",          merchant: "W Hotels" },
    { date: dateAt(2026, 2, 8),   name: "Uber Eats",                       amount: 38,   category: "Food & Dining",   merchant: "Uber Eats" },
    { date: dateAt(2026, 2, 12),  name: "Netflix",                         amount: 22.99,category: "Entertainment",   merchant: "Netflix" },
    { date: dateAt(2026, 2, 14),  name: "Spotify Premium",                 amount: 10.99,category: "Entertainment",   merchant: "Spotify" },
    { date: dateAt(2026, 2, 18),  name: "CLEAR Plus Membership",           amount: 189,  category: "Travel",          merchant: "CLEAR" },
    { date: dateAt(2026, 2, 20),  name: "Saks Fifth Avenue",               amount: 275,  category: "Shopping",        merchant: "Saks" },
    { date: dateAt(2026, 3, 1),   name: "Uber Cash",                       amount: -15,  category: "Credits",         merchant: "Uber" },
    { date: dateAt(2026, 3, 3),   name: "Delta Airlines — LAX to SFO",     amount: 195,  category: "Travel",          merchant: "Delta" },
    { date: dateAt(2026, 3, 7),   name: "Uber",                            amount: 36,   category: "Transportation",  merchant: "Uber" },
    { date: dateAt(2026, 3, 10),  name: "Waldorf Astoria",                 amount: 890,  category: "Travel",          merchant: "Waldorf Astoria" },
    { date: dateAt(2026, 3, 12),  name: "Netflix",                         amount: 22.99,category: "Entertainment",   merchant: "Netflix" },
  ]

  let counter = 0
  for (const t of txns) {
    counter++
    await db.financeTransaction.upsert({
      where: { userId_externalId: { userId: USER_ID, externalId: `demo-amex-${counter}` } },
      update: {},
      create: {
        userId: USER_ID,
        accountId: amexAccount.id,
        externalId: `demo-amex-${counter}`,
        provider: "manual",
        date: t.date,
        name: t.name,
        merchantName: t.merchant,
        amount: t.amount,
        currency: "USD",
        category: t.category,
        isRecurring: ["Netflix", "Spotify Premium", "Uber Cash"].includes(t.name),
      },
    })
  }

  // Liability
  await db.financeLiabilityCreditCard.upsert({
    where: { userId_accountId: { userId: USER_ID, accountId: amexAccount.id } },
    update: {},
    create: {
      userId: USER_ID,
      accountId: amexAccount.id,
      isOverdue: false,
      lastPaymentAmount: 4800,
      lastPaymentDate: dateAt(2026, 2, 25),
      lastStatementBalance: 2450,
      lastStatementDate: dateAt(2026, 2, 28),
      minimumPaymentAmount: 2450, // charge card — must pay in full
      nextPaymentDueDate: dateAt(2026, 3, 25),
      aprs: [{ type: "purchase", aprPercentage: 0, note: "Pay in full — charge card" }],
    },
  })

  console.log(`💳 Created Amex Platinum with ${counter} transactions, ${perks.length} perks, ${rates.length} rates`)
}

// ── Subscriptions & Bills ────────────────────────────────────────────────────

async function seedSubscriptions() {
  const existing = await db.financeSubscription.count({ where: { userId: USER_ID } })
  if (existing > 0) {
    console.log(`📺 Subscriptions already seeded (${existing})`)
    return
  }
  console.log("📺 Seeding subscriptions & bills...")

  const subs = [
    // Active subscriptions
    { merchant: "Netflix",           amount: 22.99, freq: "monthly", cat: "Entertainment",    billType: "subscription", status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 12), nextCharge: dateAt(2026, 4, 12) },
    { merchant: "Spotify Premium",   amount: 10.99, freq: "monthly", cat: "Entertainment",    billType: "subscription", status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 14), nextCharge: dateAt(2026, 4, 14) },
    { merchant: "YouTube Premium",   amount: 13.99, freq: "monthly", cat: "Entertainment",    billType: "subscription", status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 1),  nextCharge: dateAt(2026, 4, 1)  },
    { merchant: "iCloud+ (200GB)",   amount: 2.99,  freq: "monthly", cat: "Cloud Storage",    billType: "subscription", status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 5),  nextCharge: dateAt(2026, 4, 5)  },
    { merchant: "ChatGPT Plus",      amount: 20.00, freq: "monthly", cat: "Productivity",     billType: "subscription", status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 8),  nextCharge: dateAt(2026, 4, 8)  },
    { merchant: "Equinox",           amount: 185.00,freq: "monthly", cat: "Health & Fitness",  billType: "membership",   status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 1),  nextCharge: dateAt(2026, 4, 1)  },
    { merchant: "Adobe Creative Cloud", amount: 59.99, freq: "monthly", cat: "Productivity",  billType: "subscription", status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 10), nextCharge: dateAt(2026, 4, 10) },

    // Bills
    { merchant: "Verizon Wireless",  amount: 85.00, freq: "monthly", cat: "Utilities",        billType: "bill",         status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 3),  nextCharge: dateAt(2026, 4, 3)  },
    { merchant: "Comcast Internet",  amount: 89.00, freq: "monthly", cat: "Utilities",        billType: "bill",         status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 12), nextCharge: dateAt(2026, 4, 12) },
    { merchant: "GEICO Auto Insurance", amount: 148.00, freq: "monthly", cat: "Insurance",    billType: "insurance",    status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 1),  nextCharge: dateAt(2026, 4, 1)  },
    { merchant: "Lemonade Renters Insurance", amount: 12.00, freq: "monthly", cat: "Insurance",billType: "insurance",   status: "active",  isWanted: true,  lastCharge: dateAt(2026, 3, 15), nextCharge: dateAt(2026, 4, 15) },

    // Annual fees
    { merchant: "Chase Sapphire Reserve", amount: 550.00, freq: "yearly", cat: "Credit Card Fee", billType: "cc_annual_fee", status: "active", isWanted: true, lastCharge: dateAt(2025, 9, 15), nextCharge: dateAt(2026, 9, 15) },
    { merchant: "Amex Platinum Card",     amount: 695.00, freq: "yearly", cat: "Credit Card Fee", billType: "cc_annual_fee", status: "active", isWanted: true, lastCharge: dateAt(2025, 11, 1), nextCharge: dateAt(2026, 11, 1) },

    // Unwanted / to cancel
    { merchant: "Hulu (no ads)",     amount: 17.99, freq: "monthly", cat: "Entertainment",    billType: "subscription", status: "active",  isWanted: false, lastCharge: dateAt(2026, 3, 6),  nextCharge: dateAt(2026, 4, 6), notes: "Haven't watched in 2 months" },
    { merchant: "Headspace",         amount: 12.99, freq: "monthly", cat: "Health & Fitness",  billType: "subscription", status: "active",  isWanted: false, lastCharge: dateAt(2026, 3, 2),  nextCharge: dateAt(2026, 4, 2), notes: "Switched to free meditation app", cancelReminder: dateAt(2026, 3, 28) },
  ]

  for (const s of subs) {
    await db.financeSubscription.create({
      data: {
        userId: USER_ID,
        merchantName: s.merchant,
        amount: s.amount,
        frequency: s.freq,
        category: s.cat,
        billType: s.billType,
        status: s.status,
        isWanted: s.isWanted,
        lastChargeDate: s.lastCharge,
        nextChargeDate: s.nextCharge,
        notes: (s as any).notes ?? null,
        cancelReminderDate: (s as any).cancelReminder ?? null,
      },
    })
  }
  console.log(`  ↳ Created ${subs.length} subscriptions & bills`)
}

// ── Recurring Streams ────────────────────────────────────────────────────────

async function seedRecurringStreams() {
  const existing = await db.financeRecurringStream.count({ where: { userId: USER_ID } })
  if (existing > 0) {
    console.log(`🔁 Recurring streams already seeded (${existing})`)
    return
  }
  console.log("🔁 Seeding recurring streams...")

  // Get Chase Checking account ID
  const checkingAcct = await db.financeAccount.findFirst({
    where: { userId: USER_ID, name: "Chase Total Checking" },
    select: { id: true },
  })
  const csrAcct = await db.financeAccount.findFirst({
    where: { userId: USER_ID, name: "Chase Sapphire Reserve" },
    select: { id: true },
  })

  if (!checkingAcct || !csrAcct) {
    console.log("  ↳ Skipping — accounts not found")
    return
  }

  const streams = [
    // Income
    { streamId: "demo-stream-salary",   accountId: checkingAcct.id, desc: "Employer Direct Deposit", merchant: "TechCorp Inc", freq: "semi_monthly", avg: -7500, last: -7500, type: "inflow",  status: "mature", cat: "Income" },
    { streamId: "demo-stream-freelance", accountId: checkingAcct.id, desc: "Freelance Invoices",     merchant: null,            freq: "irregular",     avg: -1025, last: -850,  type: "inflow",  status: "mature", cat: "Income" },
    // Fixed expenses
    { streamId: "demo-stream-rent",      accountId: checkingAcct.id, desc: "ACH Transfer — Rent",    merchant: null,            freq: "monthly",       avg: 2200,  last: 2200,  type: "outflow", status: "mature", cat: "Housing" },
    { streamId: "demo-stream-pge",       accountId: checkingAcct.id, desc: "PG&E Electric",          merchant: "PG&E",          freq: "monthly",       avg: 149,   last: 138,   type: "outflow", status: "mature", cat: "Utilities" },
    { streamId: "demo-stream-comcast",   accountId: checkingAcct.id, desc: "Internet — Comcast",     merchant: "Comcast",       freq: "monthly",       avg: 89,    last: 89,    type: "outflow", status: "mature", cat: "Utilities" },
    { streamId: "demo-stream-water",     accountId: checkingAcct.id, desc: "Water & Sewage",         merchant: null,            freq: "monthly",       avg: 48,    last: 44,    type: "outflow", status: "mature", cat: "Utilities" },
    // Subscriptions on card
    { streamId: "demo-stream-equinox",   accountId: csrAcct.id,      desc: "Equinox Gym",            merchant: "Equinox",       freq: "monthly",       avg: 185,   last: 185,   type: "outflow", status: "mature", cat: "Health & Fitness" },
  ]

  for (const s of streams) {
    await db.financeRecurringStream.upsert({
      where: { userId_streamId: { userId: USER_ID, streamId: s.streamId } },
      update: {},
      create: {
        userId: USER_ID,
        streamId: s.streamId,
        accountId: s.accountId,
        description: s.desc,
        merchantName: s.merchant,
        frequency: s.freq,
        averageAmount: s.avg,
        lastAmount: s.last,
        streamType: s.type,
        status: s.status,
        category: s.cat,
        isActive: true,
        firstDate: dateAt(2025, 9, 1),
        lastDate: dateAt(2026, 3, 1),
      },
    })
  }
  console.log(`  ↳ Created ${streams.length} recurring streams`)
}

main().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
