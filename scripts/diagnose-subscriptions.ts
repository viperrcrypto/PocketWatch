import "dotenv/config"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { classifyBillType, enrichMerchantName, type BillType } from "@/lib/finance/bill-type-classifier"

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const db = new PrismaClient({ adapter })

async function main() {
  const users = await db.user.findMany({ select: { id: true, email: true } })
  if (users.length === 0) { console.log("No users found"); return }

  const user = users[0]
  console.log(`\nDiagnosing subscriptions for: ${user.email}\n`)

  const subscriptions = await db.financeSubscription.findMany({
    where: { userId: user.id, status: { not: "dismissed" } },
    orderBy: { amount: "desc" },
  })

  const accountIds = [...new Set(
    subscriptions.map((s) => s.accountId).filter((id): id is string => id != null)
  )]
  const accounts = accountIds.length > 0
    ? await db.financeAccount.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, type: true, subtype: true, mask: true, institution: { select: { institutionName: true } } },
      })
    : []
  const accountMap = new Map(accounts.map((a) => [a.id, a]))

  // Header
  const header = [
    "Merchant".padEnd(38),
    "Bill Type".padEnd(15),
    "Freq".padEnd(12),
    "Amount".padStart(10),
    "Account".padEnd(28),
    "Reason",
  ].join(" │ ")

  const sep = "─".repeat(header.length + 10)
  console.log(sep)
  console.log(header)
  console.log(sep)

  const counts: Record<string, { count: number; total: number }> = {}

  for (const s of subscriptions) {
    const acct = s.accountId ? accountMap.get(s.accountId) : null
    const { billType, reason } = classifyBillType({
      merchantName: s.merchantName,
      frequency: s.frequency,
      category: s.category,
      amount: s.amount,
      accountType: acct?.type ?? null,
      accountSubtype: acct?.subtype ?? null,
    })

    const effectiveType = (s.billType as BillType | null) ?? billType
    const enrichedName = enrichMerchantName(
      s.merchantName,
      acct?.institution?.institutionName ?? null,
      acct?.mask ?? null,
    )

    const acctLabel = acct
      ? `${acct.institution?.institutionName ?? "?"} ••••${acct.mask ?? "????"}`
      : "—"

    const row = [
      enrichedName.slice(0, 38).padEnd(38),
      effectiveType.padEnd(15),
      s.frequency.padEnd(12),
      `$${s.amount.toFixed(2)}`.padStart(10),
      acctLabel.slice(0, 28).padEnd(28),
      reason.slice(0, 50),
    ].join(" │ ")

    console.log(row)

    if (!counts[effectiveType]) counts[effectiveType] = { count: 0, total: 0 }
    counts[effectiveType].count++
    counts[effectiveType].total += s.amount
  }

  console.log(sep)
  console.log("\nSummary:")
  const typeLabels: Record<string, string> = {
    subscription: "Subscriptions",
    cc_annual_fee: "CC Annual Fees",
    insurance: "Insurance",
    membership: "Memberships",
    bill: "Bills",
  }
  for (const [type, { count, total }] of Object.entries(counts)) {
    const label = typeLabels[type] ?? type
    const freq = ["subscription", "insurance", "bill"].includes(type) ? "/mo" : "/yr"
    console.log(`  ${label}: ${count} ($${total.toFixed(2)}${freq})`)
  }

  // Total this month
  const active = subscriptions.filter((s) => s.status === "active")
  const monthlyBurn = active.reduce((sum, s) => {
    const acct = s.accountId ? accountMap.get(s.accountId) : null
    const { billType } = classifyBillType({
      merchantName: s.merchantName, frequency: s.frequency, category: s.category,
      amount: s.amount, accountType: acct?.type ?? null, accountSubtype: acct?.subtype ?? null,
    })
    const effective = (s.billType as string | null) ?? billType
    if (effective !== "subscription") return sum
    if (s.frequency === "monthly") return sum + s.amount
    if (s.frequency === "weekly") return sum + s.amount * 4.33
    if (s.frequency === "biweekly") return sum + s.amount * 2.17
    return sum
  }, 0)

  console.log(`\n  Monthly subscription burn: $${monthlyBurn.toFixed(2)}/mo`)
  console.log(`  Total subscriptions: ${subscriptions.length}`)
  console.log()
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
