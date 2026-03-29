import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const subs = await db.financeSubscription.findMany({
  where: { status: 'active', lastTransactionId: null },
  select: { id: true, merchantName: true, amount: true, userId: true },
})
console.log('Missing lastTransactionId:', subs.length)

let linked = 0
for (const sub of subs) {
  const keyword = sub.merchantName.split(' ')[0]
  if (keyword.length < 3) continue
  const tx = await db.financeTransaction.findFirst({
    where: {
      userId: sub.userId,
      amount: { gte: sub.amount * 0.8, lte: sub.amount * 1.2 },
      OR: [
        { merchantName: { contains: keyword, mode: 'insensitive' } },
        { name: { contains: keyword, mode: 'insensitive' } },
      ],
      isDuplicate: false, isExcluded: false,
    },
    orderBy: { date: 'desc' },
    select: { id: true, name: true },
  })
  if (tx) {
    await db.financeSubscription.update({ where: { id: sub.id }, data: { lastTransactionId: tx.id } })
    linked++
    console.log('  ✓', sub.merchantName, '→', tx.name)
  }
}
console.log('Linked:', linked, '/', subs.length)
await db.$disconnect()
