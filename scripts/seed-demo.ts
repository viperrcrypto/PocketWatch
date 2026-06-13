/**
 * Demo data seeder for PocketWatch showcase video.
 * Adds realistic financial data alongside existing real data.
 *
 * Run: npx tsx scripts/seed-demo.ts
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

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(days: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

function dateAt(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day)
}

let txCounter = 0
function txId(): string {
  return `demo-txn-${String(++txCounter).padStart(4, "0")}`
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔐 Deriving encryption key from session DEK...")
  const dekHex = await unwrapDek(ENCRYPTED_DEK)

  console.log("🌱 Starting demo data seed...")

  await withEncryptionKey(dekHex, async () => {
    await seedFinanceInstitutions()
    await seedBudgets()
    await seedManualCryptoBalances()
    await seedFinanceSnapshots()
  })

  console.log("✅ Demo seed complete!")
  process.exit(0)
}

// ── Finance Institutions + Accounts + Transactions ───────────────────────────

async function seedFinanceInstitutions() {
  // -- Chase Bank --
  console.log("🏦 Creating Chase Bank...")
  const existingChase = await db.financeInstitution.findFirst({
    where: { userId: USER_ID, institutionName: "Chase" },
  })

  let chaseId: string
  if (existingChase) {
    chaseId = existingChase.id
    console.log("  ↳ Chase already exists, reusing")
  } else {
    const chase = await db.financeInstitution.create({
      data: {
        userId: USER_ID,
        provider: "manual",
        institutionName: "Chase",
        institutionLogo: "https://logo.clearbit.com/chase.com",
        status: "active",
        lastSyncedAt: new Date(),
      },
    })
    chaseId = chase.id
    console.log("  ↳ Created Chase institution")
  }

  // Chase accounts
  const chaseChecking = await upsertAccount({
    institutionId: chaseId,
    externalId: "demo-chase-checking-001",
    name: "Chase Total Checking",
    officialName: null,
    type: "depository",
    subtype: "checking",
    mask: "4827",
    currentBalance: 14250,
    availableBalance: 14250,
  })

  const chaseSavings = await upsertAccount({
    institutionId: chaseId,
    externalId: "demo-chase-savings-001",
    name: "Chase High Yield Savings",
    officialName: null,
    type: "depository",
    subtype: "savings",
    mask: "1193",
    currentBalance: 48000,
    availableBalance: 48000,
  })

  const chaseCSR = await upsertAccount({
    institutionId: chaseId,
    externalId: "demo-chase-csr-001",
    name: "Chase Sapphire Reserve",
    officialName: null,
    type: "credit",
    subtype: "credit card",
    mask: "7831",
    currentBalance: -3840,
    availableBalance: 21160,
    creditLimit: 25000,
  })

  // Chase Sapphire Reserve credit card profile
  const csrProfile = await upsertCreditCardProfile({
    accountId: chaseCSR.id,
    cardNetwork: "visa",
    cardName: "Chase Sapphire Reserve",
    annualFee: 550,
    rewardType: "points",
    rewardProgram: "Chase Ultimate Rewards",
    pointsBalance: 142500,
    pointValue: 0.015,
    cashbackBalance: null,
    totalEarned: 3210,
    totalRedeemed: 1500,
    baseRewardRate: 1,
    bonusCategories: [
      { category: "Travel", rate: 3, unit: "points" },
      { category: "Dining", rate: 3, unit: "points" },
    ],
    statementCredits: [{ name: "$300 Travel Credit", value: 300, used: 300 }],
    annualFeeDate: dateAt(2026, 9, 15),
    transferPartners: ["Hyatt", "United", "Southwest", "British Airways"],
    cardImageUrl: null,
  })

  // Chase CSR perks
  await upsertCardPerks(csrProfile.id, [
    { name: "$300 Annual Travel Credit", value: 300, isUsed: true },
    { name: "Priority Pass Lounge Access", value: 400, isUsed: false },
    { name: "Global Entry / TSA PreCheck Credit", value: 100, isUsed: false },
    { name: "DashPass Membership", value: 96, isUsed: true },
    { name: "Lyft Pink Membership", value: 199, isUsed: false },
  ])

  // Chase CSR reward rates
  await upsertRewardRates(csrProfile.id, "points", [
    { category: "Travel", rate: 3 },
    { category: "Dining", rate: 3 },
    { category: "Groceries", rate: 1 },
    { category: "Gas", rate: 1 },
    { category: "Shopping", rate: 1 },
    { category: "Entertainment", rate: 1 },
    { category: "Health & Fitness", rate: 1 },
  ])

  // Chase CSR liability
  await upsertCreditCardLiability({
    accountId: chaseCSR.id,
    lastStatementBalance: 3840,
    lastStatementDate: dateAt(2026, 2, 20),
    nextPaymentDueDate: dateAt(2026, 3, 15),
    minimumPaymentAmount: 35,
    lastPaymentAmount: 2200,
    lastPaymentDate: dateAt(2026, 2, 15),
    aprs: [
      { type: "purchase", balanceSubjectToApr: 3840, aprPercentage: 21.99 },
      { type: "cash_advance", aprPercentage: 26.99 },
    ],
  })

  // Transactions for Chase Checking
  await seedCheckingTransactions(chaseChecking.id)

  // Transactions for Chase Sapphire Reserve
  await seedCreditCardTransactions(chaseCSR.id)

  // -- Fidelity --
  console.log("📈 Creating Fidelity Investments...")
  const existingFidelity = await db.financeInstitution.findFirst({
    where: { userId: USER_ID, institutionName: "Fidelity Investments" },
  })

  let fidelityId: string
  if (existingFidelity) {
    fidelityId = existingFidelity.id
    console.log("  ↳ Fidelity already exists, reusing")
  } else {
    const fidelity = await db.financeInstitution.create({
      data: {
        userId: USER_ID,
        provider: "manual",
        institutionName: "Fidelity Investments",
        institutionLogo: "https://logo.clearbit.com/fidelity.com",
        status: "active",
        lastSyncedAt: new Date(),
      },
    })
    fidelityId = fidelity.id
    console.log("  ↳ Created Fidelity institution")
  }

  const fidelityBrokerage = await upsertAccount({
    institutionId: fidelityId,
    externalId: "demo-fidelity-brokerage-001",
    name: "Fidelity Brokerage Account",
    officialName: null,
    type: "investment",
    subtype: "brokerage",
    mask: "2209",
    currentBalance: 127450,
    availableBalance: 19790,
  })

  await upsertAccount({
    institutionId: fidelityId,
    externalId: "demo-fidelity-rothira-001",
    name: "Fidelity Roth IRA",
    officialName: null,
    type: "investment",
    subtype: "ira",
    mask: "5514",
    currentBalance: 52300,
    availableBalance: 0,
  })

  // Investment securities & holdings
  await seedInvestmentHoldings(fidelityBrokerage.id)
}

// ── Account helpers ──────────────────────────────────────────────────────────

async function upsertAccount(data: {
  institutionId: string
  externalId: string
  name: string
  officialName: null | string
  type: string
  subtype: string | null
  mask: string | null
  currentBalance: number
  availableBalance: number
  creditLimit?: number
}) {
  return db.financeAccount.upsert({
    where: { userId_externalId: { userId: USER_ID, externalId: data.externalId } },
    update: { currentBalance: data.currentBalance, availableBalance: data.availableBalance },
    create: {
      userId: USER_ID,
      institutionId: data.institutionId,
      externalId: data.externalId,
      name: data.name,
      officialName: data.officialName,
      type: data.type,
      subtype: data.subtype,
      mask: data.mask,
      currentBalance: data.currentBalance,
      availableBalance: data.availableBalance,
      creditLimit: data.creditLimit ?? null,
      currency: "USD",
    },
  })
}

async function upsertCreditCardProfile(data: {
  accountId: string
  cardNetwork: string
  cardName: string
  annualFee: number
  rewardType: string
  rewardProgram: string
  pointsBalance: number | null
  pointValue: number | null
  cashbackBalance: number | null
  totalEarned: number
  totalRedeemed: number
  baseRewardRate: number
  bonusCategories: unknown[]
  statementCredits: unknown[] | null
  annualFeeDate: Date | null
  transferPartners: string[] | null
  cardImageUrl: string | null
}) {
  const existing = await db.creditCardProfile.findUnique({
    where: { userId_accountId: { userId: USER_ID, accountId: data.accountId } },
  })
  if (existing) {
    console.log(`  ↳ CreditCardProfile for ${data.cardName} already exists`)
    return existing
  }
  return db.creditCardProfile.create({
    data: {
      userId: USER_ID,
      accountId: data.accountId,
      cardNetwork: data.cardNetwork,
      cardName: data.cardName,
      annualFee: data.annualFee,
      rewardType: data.rewardType,
      rewardProgram: data.rewardProgram,
      pointsBalance: data.pointsBalance,
      pointValue: data.pointValue,
      cashbackBalance: data.cashbackBalance,
      totalEarned: data.totalEarned,
      totalRedeemed: data.totalRedeemed,
      baseRewardRate: data.baseRewardRate,
      bonusCategories: data.bonusCategories,
      statementCredits: data.statementCredits,
      annualFeeDate: data.annualFeeDate,
      transferPartners: data.transferPartners,
      cardImageUrl: data.cardImageUrl,
    },
  })
}

async function upsertCardPerks(cardProfileId: string, perks: {
  name: string; value: number; isUsed: boolean
}[]) {
  // Delete existing demo perks for this card and re-create
  const existing = await db.creditCardPerk.count({ where: { cardProfileId } })
  if (existing > 0) return
  for (const perk of perks) {
    await db.creditCardPerk.create({
      data: { cardProfileId, name: perk.name, value: perk.value, isUsed: perk.isUsed },
    })
  }
}

async function upsertRewardRates(
  cardProfileId: string,
  rewardType: string,
  rates: { category: string; rate: number }[]
) {
  for (const r of rates) {
    await db.creditCardRewardRate.upsert({
      where: { cardProfileId_spendingCategory: { cardProfileId, spendingCategory: r.category } },
      update: { rewardRate: r.rate },
      create: { cardProfileId, spendingCategory: r.category, rewardRate: r.rate, rewardType },
    })
  }
}

async function upsertCreditCardLiability(data: {
  accountId: string
  lastStatementBalance: number
  lastStatementDate: Date
  nextPaymentDueDate: Date
  minimumPaymentAmount: number
  lastPaymentAmount: number
  lastPaymentDate: Date
  aprs: unknown[]
}) {
  return db.financeLiabilityCreditCard.upsert({
    where: { userId_accountId: { userId: USER_ID, accountId: data.accountId } },
    update: {},
    create: {
      userId: USER_ID,
      accountId: data.accountId,
      isOverdue: false,
      lastPaymentAmount: data.lastPaymentAmount,
      lastPaymentDate: data.lastPaymentDate,
      lastStatementBalance: data.lastStatementBalance,
      lastStatementDate: data.lastStatementDate,
      minimumPaymentAmount: data.minimumPaymentAmount,
      nextPaymentDueDate: data.nextPaymentDueDate,
      aprs: data.aprs,
    },
  })
}

// ── Checking Transactions ────────────────────────────────────────────────────

async function seedCheckingTransactions(accountId: string) {
  const existing = await db.financeTransaction.count({
    where: { userId: USER_ID, accountId },
  })
  if (existing > 0) {
    console.log(`  ↳ Checking transactions already seeded (${existing})`)
    return
  }
  console.log("  ↳ Seeding Chase Checking transactions...")

  const txns = [
    // December 2025
    { date: dateAt(2025, 12, 1),  name: "Employer Direct Deposit",            amount: -7500,  category: "Income",   merchant: null },
    { date: dateAt(2025, 12, 2),  name: "ACH Transfer — Rent",                amount: 2200,   category: "Housing",  merchant: null },
    { date: dateAt(2025, 12, 5),  name: "Transfer to Chase High Yield Savings",amount: -2000,  category: "Transfer", merchant: null },
    { date: dateAt(2025, 12, 10), name: "PG&E Electric",                       amount: 142,    category: "Utilities",merchant: "PG&E" },
    { date: dateAt(2025, 12, 12), name: "Internet — Comcast",                  amount: 89,     category: "Utilities",merchant: "Comcast" },
    { date: dateAt(2025, 12, 15), name: "Water & Sewage",                      amount: 48,     category: "Utilities",merchant: null },
    { date: dateAt(2025, 12, 20), name: "Chase Sapphire Reserve Payment",      amount: 3100,   category: "Credit Card Payment", merchant: null },
    { date: dateAt(2025, 12, 28), name: "Holiday Bonus",                       amount: -2500,  category: "Income",   merchant: null },
    // January 2026
    { date: dateAt(2026, 1, 1),   name: "Employer Direct Deposit",             amount: -7500,  category: "Income",   merchant: null },
    { date: dateAt(2026, 1, 2),   name: "ACH Transfer — Rent",                 amount: 2200,   category: "Housing",  merchant: null },
    { date: dateAt(2026, 1, 5),   name: "Transfer to Chase High Yield Savings", amount: -2000, category: "Transfer", merchant: null },
    { date: dateAt(2026, 1, 10),  name: "PG&E Electric",                       amount: 161,    category: "Utilities",merchant: "PG&E" },
    { date: dateAt(2026, 1, 12),  name: "Internet — Comcast",                  amount: 89,     category: "Utilities",merchant: "Comcast" },
    { date: dateAt(2026, 1, 16),  name: "Water & Sewage",                      amount: 52,     category: "Utilities",merchant: null },
    { date: dateAt(2026, 1, 20),  name: "Chase Sapphire Reserve Payment",      amount: 2800,   category: "Credit Card Payment", merchant: null },
    { date: dateAt(2026, 1, 25),  name: "Freelance Invoice #204",              amount: -1200,  category: "Income",   merchant: null },
    // February 2026
    { date: dateAt(2026, 2, 1),   name: "Employer Direct Deposit",             amount: -7500,  category: "Income",   merchant: null },
    { date: dateAt(2026, 2, 2),   name: "ACH Transfer — Rent",                 amount: 2200,   category: "Housing",  merchant: null },
    { date: dateAt(2026, 2, 5),   name: "Transfer to Chase High Yield Savings", amount: -2000, category: "Transfer", merchant: null },
    { date: dateAt(2026, 2, 10),  name: "PG&E Electric",                       amount: 155,    category: "Utilities",merchant: "PG&E" },
    { date: dateAt(2026, 2, 12),  name: "Internet — Comcast",                  amount: 89,     category: "Utilities",merchant: "Comcast" },
    { date: dateAt(2026, 2, 15),  name: "Water & Sewage",                      amount: 44,     category: "Utilities",merchant: null },
    { date: dateAt(2026, 2, 18),  name: "Chase Sapphire Reserve Payment",      amount: 3200,   category: "Credit Card Payment", merchant: null },
    { date: dateAt(2026, 2, 28),  name: "Freelance Invoice #208",              amount: -850,   category: "Income",   merchant: null },
    // March 2026
    { date: dateAt(2026, 3, 1),   name: "Employer Direct Deposit",             amount: -7500,  category: "Income",   merchant: null },
    { date: dateAt(2026, 3, 2),   name: "ACH Transfer — Rent",                 amount: 2200,   category: "Housing",  merchant: null },
    { date: dateAt(2026, 3, 8),   name: "PG&E Electric",                       amount: 138,    category: "Utilities",merchant: "PG&E" },
  ]

  for (const t of txns) {
    await db.financeTransaction.upsert({
      where: { userId_externalId: { userId: USER_ID, externalId: txId() } },
      update: {},
      create: {
        userId: USER_ID,
        accountId,
        externalId: `demo-checking-${txCounter}`,
        provider: "manual",
        date: t.date,
        name: t.name,
        merchantName: t.merchant,
        amount: t.amount,
        currency: "USD",
        category: t.category,
        isRecurring: ["Employer Direct Deposit", "ACH Transfer — Rent", "Internet — Comcast"].includes(t.name),
      },
    })
  }
  console.log(`  ↳ Created ${txns.length} checking transactions`)
}

// ── Credit Card Transactions ─────────────────────────────────────────────────

async function seedCreditCardTransactions(accountId: string) {
  const existing = await db.financeTransaction.count({
    where: { userId: USER_ID, accountId },
  })
  if (existing > 0) {
    console.log(`  ↳ CC transactions already seeded (${existing})`)
    return
  }
  console.log("  ↳ Seeding Chase Sapphire Reserve transactions...")

  const txns = [
    // December 2025
    { date: dateAt(2025, 12, 3),  name: "Nobu Restaurant",                     amount: 185,  category: "Food & Dining",     merchant: "Nobu" },
    { date: dateAt(2025, 12, 4),  name: "Whole Foods Market",                  amount: 94,   category: "Food & Dining",     merchant: "Whole Foods" },
    { date: dateAt(2025, 12, 5),  name: "Delta Air Lines",                     amount: 548,  category: "Travel",            merchant: "Delta" },
    { date: dateAt(2025, 12, 6),  name: "Trader Joe's",                        amount: 67,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2025, 12, 7),  name: "Shell Gas Station",                   amount: 62,   category: "Transportation",    merchant: "Shell" },
    { date: dateAt(2025, 12, 8),  name: "Amazon.com",                          amount: 143,  category: "Shopping",          merchant: "Amazon" },
    { date: dateAt(2025, 12, 9),  name: "Equinox Gym",                         amount: 185,  category: "Health & Fitness",  merchant: "Equinox" },
    { date: dateAt(2025, 12, 10), name: "DoorDash",                            amount: 38,   category: "Food & Dining",     merchant: "DoorDash" },
    { date: dateAt(2025, 12, 11), name: "Sweetgreen",                          amount: 22,   category: "Food & Dining",     merchant: "Sweetgreen" },
    { date: dateAt(2025, 12, 12), name: "Marriott Hotels",                     amount: 389,  category: "Travel",            merchant: "Marriott" },
    { date: dateAt(2025, 12, 13), name: "Trader Joe's",                        amount: 78,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2025, 12, 14), name: "Target",                              amount: 112,  category: "Shopping",          merchant: "Target" },
    { date: dateAt(2025, 12, 16), name: "Chevron",                             amount: 58,   category: "Transportation",    merchant: "Chevron" },
    { date: dateAt(2025, 12, 17), name: "Postmates",                           amount: 44,   category: "Food & Dining",     merchant: "Postmates" },
    { date: dateAt(2025, 12, 18), name: "Apple Store",                         amount: 149,  category: "Shopping",          merchant: "Apple" },
    { date: dateAt(2025, 12, 19), name: "Ramen Nagi",                          amount: 56,   category: "Food & Dining",     merchant: "Ramen Nagi" },
    { date: dateAt(2025, 12, 20), name: "Whole Foods Market",                  amount: 88,   category: "Food & Dining",     merchant: "Whole Foods" },
    { date: dateAt(2025, 12, 21), name: "Amazon.com",                          amount: 239,  category: "Shopping",          merchant: "Amazon" },
    { date: dateAt(2025, 12, 22), name: "United Airlines",                     amount: 622,  category: "Travel",            merchant: "United" },
    { date: dateAt(2025, 12, 23), name: "Hyatt Regency",                       amount: 445,  category: "Travel",            merchant: "Hyatt" },
    { date: dateAt(2025, 12, 26), name: "DoorDash",                            amount: 52,   category: "Food & Dining",     merchant: "DoorDash" },
    { date: dateAt(2025, 12, 27), name: "Nike",                                amount: 180,  category: "Shopping",          merchant: "Nike" },
    { date: dateAt(2025, 12, 28), name: "Trader Joe's",                        amount: 91,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2025, 12, 30), name: "Shell Gas Station",                   amount: 55,   category: "Transportation",    merchant: "Shell" },
    // January 2026
    { date: dateAt(2026, 1, 2),   name: "Nobu Palo Alto",                      amount: 168,  category: "Food & Dining",     merchant: "Nobu" },
    { date: dateAt(2026, 1, 3),   name: "Whole Foods Market",                  amount: 102,  category: "Food & Dining",     merchant: "Whole Foods" },
    { date: dateAt(2026, 1, 4),   name: "Chevron",                             amount: 64,   category: "Transportation",    merchant: "Chevron" },
    { date: dateAt(2026, 1, 5),   name: "Amazon.com",                          amount: 87,   category: "Shopping",          merchant: "Amazon" },
    { date: dateAt(2026, 1, 6),   name: "Equinox Gym",                         amount: 185,  category: "Health & Fitness",  merchant: "Equinox" },
    { date: dateAt(2026, 1, 7),   name: "Sweetgreen",                          amount: 19,   category: "Food & Dining",     merchant: "Sweetgreen" },
    { date: dateAt(2026, 1, 8),   name: "DoorDash",                            amount: 41,   category: "Food & Dining",     merchant: "DoorDash" },
    { date: dateAt(2026, 1, 9),   name: "Trader Joe's",                        amount: 73,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2026, 1, 10),  name: "Southwest Airlines",                  amount: 312,  category: "Travel",            merchant: "Southwest" },
    { date: dateAt(2026, 1, 11),  name: "Shell Gas Station",                   amount: 61,   category: "Transportation",    merchant: "Shell" },
    { date: dateAt(2026, 1, 13),  name: "Target",                              amount: 156,  category: "Shopping",          merchant: "Target" },
    { date: dateAt(2026, 1, 14),  name: "Starbucks",                           amount: 18,   category: "Food & Dining",     merchant: "Starbucks" },
    { date: dateAt(2026, 1, 15),  name: "Whole Foods Market",                  amount: 99,   category: "Food & Dining",     merchant: "Whole Foods" },
    { date: dateAt(2026, 1, 17),  name: "Hakkasan SF",                         amount: 225,  category: "Food & Dining",     merchant: "Hakkasan" },
    { date: dateAt(2026, 1, 18),  name: "Amazon.com",                          amount: 345,  category: "Shopping",          merchant: "Amazon" },
    { date: dateAt(2026, 1, 20),  name: "Chevron",                             amount: 58,   category: "Transportation",    merchant: "Chevron" },
    { date: dateAt(2026, 1, 21),  name: "Postmates",                           amount: 47,   category: "Food & Dining",     merchant: "Postmates" },
    { date: dateAt(2026, 1, 22),  name: "REI",                                 amount: 189,  category: "Shopping",          merchant: "REI" },
    { date: dateAt(2026, 1, 23),  name: "Starbucks",                           amount: 16,   category: "Food & Dining",     merchant: "Starbucks" },
    { date: dateAt(2026, 1, 24),  name: "Uber",                                amount: 22,   category: "Transportation",    merchant: "Uber" },
    { date: dateAt(2026, 1, 26),  name: "Trader Joe's",                        amount: 85,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2026, 1, 27),  name: "Lyft",                                amount: 18,   category: "Transportation",    merchant: "Lyft" },
    { date: dateAt(2026, 1, 29),  name: "SF Farmers Market",                   amount: 62,   category: "Food & Dining",     merchant: null },
    { date: dateAt(2026, 1, 30),  name: "Shell Gas Station",                   amount: 60,   category: "Transportation",    merchant: "Shell" },
    // February 2026
    { date: dateAt(2026, 2, 1),   name: "Equinox Gym",                         amount: 185,  category: "Health & Fitness",  merchant: "Equinox" },
    { date: dateAt(2026, 2, 2),   name: "Nobu Malibu",                         amount: 310,  category: "Food & Dining",     merchant: "Nobu" },
    { date: dateAt(2026, 2, 3),   name: "Whole Foods Market",                  amount: 108,  category: "Food & Dining",     merchant: "Whole Foods" },
    { date: dateAt(2026, 2, 4),   name: "Delta Air Lines",                     amount: 489,  category: "Travel",            merchant: "Delta" },
    { date: dateAt(2026, 2, 5),   name: "Chevron",                             amount: 66,   category: "Transportation",    merchant: "Chevron" },
    { date: dateAt(2026, 2, 6),   name: "DoorDash",                            amount: 43,   category: "Food & Dining",     merchant: "DoorDash" },
    { date: dateAt(2026, 2, 7),   name: "Amazon.com",                          amount: 211,  category: "Shopping",          merchant: "Amazon" },
    { date: dateAt(2026, 2, 8),   name: "Starbucks",                           amount: 17,   category: "Food & Dining",     merchant: "Starbucks" },
    { date: dateAt(2026, 2, 9),   name: "Marriott Resort",                     amount: 720,  category: "Travel",            merchant: "Marriott" },
    { date: dateAt(2026, 2, 10),  name: "Sweetgreen",                          amount: 24,   category: "Food & Dining",     merchant: "Sweetgreen" },
    { date: dateAt(2026, 2, 11),  name: "Trader Joe's",                        amount: 79,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2026, 2, 12),  name: "Shell Gas Station",                   amount: 63,   category: "Transportation",    merchant: "Shell" },
    { date: dateAt(2026, 2, 13),  name: "Target",                              amount: 134,  category: "Shopping",          merchant: "Target" },
    { date: dateAt(2026, 2, 14),  name: "Romantic Dinner - Gary Danko",        amount: 425,  category: "Food & Dining",     merchant: "Gary Danko" },
    { date: dateAt(2026, 2, 15),  name: "Uber",                                amount: 28,   category: "Transportation",    merchant: "Uber" },
    { date: dateAt(2026, 2, 17),  name: "Whole Foods Market",                  amount: 97,   category: "Food & Dining",     merchant: "Whole Foods" },
    { date: dateAt(2026, 2, 18),  name: "Amazon.com",                          amount: 178,  category: "Shopping",          merchant: "Amazon" },
    { date: dateAt(2026, 2, 19),  name: "Lyft",                                amount: 21,   category: "Transportation",    merchant: "Lyft" },
    { date: dateAt(2026, 2, 20),  name: "Blue Bottle Coffee",                  amount: 14,   category: "Food & Dining",     merchant: "Blue Bottle" },
    { date: dateAt(2026, 2, 21),  name: "Trader Joe's",                        amount: 82,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2026, 2, 22),  name: "Chevron",                             amount: 61,   category: "Transportation",    merchant: "Chevron" },
    { date: dateAt(2026, 2, 23),  name: "Equinox Cafe",                        amount: 28,   category: "Food & Dining",     merchant: "Equinox" },
    { date: dateAt(2026, 2, 24),  name: "Warby Parker",                        amount: 295,  category: "Shopping",          merchant: "Warby Parker" },
    { date: dateAt(2026, 2, 25),  name: "DoorDash",                            amount: 49,   category: "Food & Dining",     merchant: "DoorDash" },
    { date: dateAt(2026, 2, 26),  name: "Starbucks",                           amount: 15,   category: "Food & Dining",     merchant: "Starbucks" },
    { date: dateAt(2026, 2, 27),  name: "Amazon.com",                          amount: 92,   category: "Shopping",          merchant: "Amazon" },
    // March 2026
    { date: dateAt(2026, 3, 1),   name: "Equinox Gym",                         amount: 185,  category: "Health & Fitness",  merchant: "Equinox" },
    { date: dateAt(2026, 3, 2),   name: "Whole Foods Market",                  amount: 95,   category: "Food & Dining",     merchant: "Whole Foods" },
    { date: dateAt(2026, 3, 3),   name: "DoorDash",                            amount: 37,   category: "Food & Dining",     merchant: "DoorDash" },
    { date: dateAt(2026, 3, 4),   name: "Shell Gas Station",                   amount: 59,   category: "Transportation",    merchant: "Shell" },
    { date: dateAt(2026, 3, 5),   name: "Amazon.com",                          amount: 124,  category: "Shopping",          merchant: "Amazon" },
    { date: dateAt(2026, 3, 6),   name: "Sweetgreen",                          amount: 21,   category: "Food & Dining",     merchant: "Sweetgreen" },
    { date: dateAt(2026, 3, 7),   name: "Trader Joe's",                        amount: 76,   category: "Food & Dining",     merchant: "Trader Joe's" },
    { date: dateAt(2026, 3, 8),   name: "Nobu SF",                             amount: 198,  category: "Food & Dining",     merchant: "Nobu" },
    { date: dateAt(2026, 3, 9),   name: "Uber",                                amount: 24,   category: "Transportation",    merchant: "Uber" },
    { date: dateAt(2026, 3, 10),  name: "Target",                              amount: 88,   category: "Shopping",          merchant: "Target" },
    { date: dateAt(2026, 3, 11),  name: "Blue Bottle Coffee",                  amount: 13,   category: "Food & Dining",     merchant: "Blue Bottle" },
    { date: dateAt(2026, 3, 12),  name: "Chevron",                             amount: 57,   category: "Transportation",    merchant: "Chevron" },
  ]

  for (const t of txns) {
    txCounter++
    await db.financeTransaction.upsert({
      where: { userId_externalId: { userId: USER_ID, externalId: `demo-csr-${txCounter}` } },
      update: {},
      create: {
        userId: USER_ID,
        accountId,
        externalId: `demo-csr-${txCounter}`,
        provider: "manual",
        date: t.date,
        name: t.name,
        merchantName: t.merchant,
        amount: t.amount,
        currency: "USD",
        category: t.category,
        isRecurring: t.name.includes("Equinox") || t.name.includes("Comcast"),
      },
    })
  }
  console.log(`  ↳ Created ${txns.length} credit card transactions`)
}

// ── Investment Holdings ──────────────────────────────────────────────────────

async function seedInvestmentHoldings(accountId: string) {
  const existing = await db.financeInvestmentHolding.count({
    where: { userId: USER_ID, accountId },
  })
  if (existing > 0) {
    console.log(`  ↳ Investment holdings already seeded (${existing})`)
    return
  }
  console.log("  ↳ Seeding Fidelity investment securities & holdings...")

  const securities = [
    { id: "demo-sec-vti",   name: "Vanguard Total Stock Market ETF",    ticker: "VTI",   type: "etf",         sector: "Broad Market", price: 246.50,  priceDate: new Date("2026-03-11") },
    { id: "demo-sec-fxaix", name: "Fidelity 500 Index Fund",            ticker: "FXAIX", type: "mutual fund", sector: "Large Cap",    price: 196.20,  priceDate: new Date("2026-03-11") },
    { id: "demo-sec-brkb",  name: "Berkshire Hathaway Inc. Class B",    ticker: "BRK.B", type: "equity",      sector: "Financials",   price: 424.80,  priceDate: new Date("2026-03-11") },
    { id: "demo-sec-aapl",  name: "Apple Inc.",                          ticker: "AAPL",  type: "equity",      sector: "Technology",   price: 192.30,  priceDate: new Date("2026-03-11") },
    { id: "demo-sec-voo",   name: "Vanguard S&P 500 ETF",               ticker: "VOO",   type: "etf",         sector: "Large Cap",    price: 497.60,  priceDate: new Date("2026-03-11") },
    { id: "demo-sec-msft",  name: "Microsoft Corporation",              ticker: "MSFT",  type: "equity",      sector: "Technology",   price: 416.40,  priceDate: new Date("2026-03-11") },
    { id: "demo-sec-spaxx", name: "Fidelity Government Money Market",   ticker: "SPAXX", type: "cash equivalent", sector: "Cash",    price: 1.00,    priceDate: new Date("2026-03-11") },
  ]

  for (const s of securities) {
    await db.financeInvestmentSecurity.upsert({
      where: { userId_securityId: { userId: USER_ID, securityId: s.id } },
      update: { closePrice: s.price, closePriceAsOf: s.priceDate },
      create: {
        userId: USER_ID,
        securityId: s.id,
        name: s.name,
        tickerSymbol: s.ticker,
        type: s.type,
        sector: s.sector,
        closePrice: s.price,
        closePriceAsOf: s.priceDate,
        isCashEquivalent: s.type === "cash equivalent",
        isoCurrencyCode: "USD",
      },
    })
  }

  const holdings = [
    { secId: "demo-sec-vti",   qty: 78,   price: 246.50, cost: 14200.00 },
    { secId: "demo-sec-fxaix", qty: 45,   price: 196.20, cost: 7100.00 },
    { secId: "demo-sec-brkb",  qty: 32,   price: 424.80, cost: 9800.00 },
    { secId: "demo-sec-aapl",  qty: 55,   price: 192.30, cost: 8200.00 },
    { secId: "demo-sec-voo",   qty: 95,   price: 497.60, cost: 38000.00 },
    { secId: "demo-sec-msft",  qty: 22,   price: 416.40, cost: 7900.00 },
    { secId: "demo-sec-spaxx", qty: 19790,price: 1.00,   cost: 19790.00 },
  ]

  for (const h of holdings) {
    const value = h.qty * h.price
    await db.financeInvestmentHolding.upsert({
      where: { userId_accountId_securityId: { userId: USER_ID, accountId, securityId: h.secId } },
      update: { institutionValue: value, institutionPrice: h.price, quantity: h.qty },
      create: {
        userId: USER_ID,
        accountId,
        securityId: h.secId,
        quantity: h.qty,
        institutionPrice: h.price,
        institutionPriceAsOf: new Date("2026-03-11"),
        institutionValue: value,
        costBasis: h.cost,
        isoCurrencyCode: "USD",
      },
    })
  }
  console.log(`  ↳ Created ${securities.length} securities & ${holdings.length} holdings`)
}

// ── Budgets ──────────────────────────────────────────────────────────────────

async function seedBudgets() {
  const existing = await db.financeBudget.count({ where: { userId: USER_ID } })
  if (existing > 0) {
    console.log(`📊 Budgets already seeded (${existing})`)
    return
  }
  console.log("📊 Seeding budgets...")

  const budgets = [
    { category: "Food & Dining",    monthlyLimit: 600 },
    { category: "Transportation",   monthlyLimit: 200 },
    { category: "Entertainment",    monthlyLimit: 150 },
    { category: "Shopping",         monthlyLimit: 500 },
    { category: "Health & Fitness", monthlyLimit: 250 },
    { category: "Utilities",        monthlyLimit: 350 },
    { category: "Travel",           monthlyLimit: 800 },
    { category: "Housing",          monthlyLimit: 2400 },
  ]

  for (const b of budgets) {
    await db.financeBudget.upsert({
      where: { userId_category: { userId: USER_ID, category: b.category } },
      update: {},
      create: { userId: USER_ID, category: b.category, monthlyLimit: b.monthlyLimit, isActive: true },
    })
  }
  console.log(`  ↳ Created ${budgets.length} budget categories`)
}

// ── Manual Crypto Balances ───────────────────────────────────────────────────

async function seedManualCryptoBalances() {
  const existing = await db.manualBalance.count({ where: { userId: USER_ID } })
  if (existing > 0) {
    console.log(`🪙 Manual balances already seeded (${existing})`)
    return
  }
  console.log("🪙 Seeding manual crypto balances...")

  const balances = [
    { asset: "BTC",    label: "Cold Storage — Ledger",   amount: "0.18",    location: "Ledger Nano X",   tags: ["cold-storage", "long-term"] },
    { asset: "SOL",    label: "Solana Hot Wallet",        amount: "85",      location: "Phantom Wallet",  tags: ["staking-eligible"] },
    { asset: "JUP",    label: "Jupiter Holdings",          amount: "5000",    location: "Jupiter",         tags: ["defi"] },
    { asset: "PENDLE", label: "Pendle Finance",            amount: "2500",    location: "Pendle",          tags: ["yield", "defi"] },
    { asset: "ETH",    label: "Spare ETH",                 amount: "0.5",     location: "MetaMask",        tags: ["gas-reserve"] },
  ]

  for (const b of balances) {
    await db.manualBalance.create({
      data: {
        userId: USER_ID,
        asset: b.asset,
        label: b.label,
        amount: b.amount,
        location: b.location,
        tags: b.tags,
      },
    })
  }
  console.log(`  ↳ Created ${balances.length} manual balances`)
}

// ── Finance Snapshots (net worth history) ────────────────────────────────────

async function seedFinanceSnapshots() {
  console.log("📈 Seeding finance snapshots (net worth history)...")

  // Historical monthly net worth snapshots (these dates don't conflict with existing daily ones)
  const snapshots = [
    {
      date: dateAt(2025, 9, 30),
      totalAssets: 162800,
      totalDebt: 4200,
      breakdown: {
        checking: 8400,
        savings: 21000,
        investment: 95600,
        ira: 32200,
        crypto: 2000, // only bank at this point
        creditCard: -4200,
      },
    },
    {
      date: dateAt(2025, 10, 31),
      totalAssets: 178400,
      totalDebt: 4800,
      breakdown: {
        checking: 9100,
        savings: 28000,
        investment: 104200,
        ira: 36200,
        creditCard: -4800,
      },
    },
    {
      date: dateAt(2025, 11, 30),
      totalAssets: 195600,
      totalDebt: 5100,
      breakdown: {
        checking: 11200,
        savings: 34000,
        investment: 112400,
        ira: 38000,
        creditCard: -5100,
      },
    },
    {
      date: dateAt(2025, 12, 31),
      totalAssets: 214200,
      totalDebt: 4600,
      breakdown: {
        checking: 13100,
        savings: 41000,
        investment: 120800,
        ira: 39300,
        creditCard: -4600,
      },
    },
    {
      date: dateAt(2026, 1, 31),
      totalAssets: 234100,
      totalDebt: 5200,
      breakdown: {
        checking: 13900,
        savings: 45200,
        investment: 124400,
        ira: 50600,
        creditCard: -5200,
      },
    },
    {
      date: dateAt(2026, 2, 28),
      totalAssets: 252108,
      totalDebt: 6856,
      breakdown: {
        checking: 14250,
        savings: 48000,
        investment: 127450,
        ira: 52300,
        bank_boa: 11108,
        creditCard: -6856,
      },
    },
  ]

  let created = 0
  for (const s of snapshots) {
    try {
      await db.financeSnapshot.upsert({
        where: { userId_date: { userId: USER_ID, date: s.date } },
        update: { totalAssets: s.totalAssets, totalDebt: s.totalDebt, netWorth: s.totalAssets - s.totalDebt },
        create: {
          userId: USER_ID,
          date: s.date,
          totalAssets: s.totalAssets,
          totalDebt: s.totalDebt,
          netWorth: s.totalAssets - s.totalDebt,
          breakdown: s.breakdown,
        },
      })
      created++
    } catch (err) {
      console.warn(`  ↳ Snapshot ${s.date.toISOString().slice(0, 10)} skipped: ${err}`)
    }
  }
  console.log(`  ↳ Created ${created} finance snapshots`)
}

// ── Run ──────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error("❌ Seed failed:", err)
  process.exit(1)
})
