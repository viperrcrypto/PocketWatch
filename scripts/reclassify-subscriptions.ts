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
  console.log(`\nReclassifying subscriptions for: ${user.email}\n`)

  const subscriptions = await db.financeSubscription.findMany({
    where: { userId: user.id },
  })

  // Load accounts for enrichment
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

  let updated = 0
  let unchanged = 0

  for (const s of subscriptions) {
    const acct = s.accountId ? accountMap.get(s.accountId) : null
    const { billType: newType, reason } = classifyBillType({
      merchantName: s.merchantName,
      frequency: s.frequency,
      category: s.category,
      amount: s.amount,
      accountType: acct?.type ?? null,
      accountSubtype: acct?.subtype ?? null,
    })

    const oldType = s.billType as BillType | null

    if (oldType !== newType) {
      await db.financeSubscription.update({
        where: { id: s.id },
        data: { billType: newType },
      })

      const enriched = enrichMerchantName(
        s.merchantName,
        acct?.institution?.institutionName ?? null,
        acct?.mask ?? null,
      )

      console.log(`  CHANGED: ${enriched.slice(0, 40).padEnd(40)} ${(oldType ?? "null").padEnd(15)} → ${newType.padEnd(15)} (${reason})`)
      updated++
    } else {
      unchanged++
    }
  }

  console.log(`\nDone: ${updated} updated, ${unchanged} unchanged (${subscriptions.length} total)`)
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
