import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { saveFinanceSnapshot, backfillHistoricalSnapshots, fetchFullPlaidHistory } from "@/lib/finance/sync"
import { NextResponse, type NextRequest } from "next/server"

type RangeKey = "1w" | "1m" | "3m" | "6m" | "1y" | "all"

interface CryptoPoint {
  timestamp: number
  value: number
}

interface FiatPoint {
  fiatAssets: number
  fiatDebt: number
  fiatNetWorth: number
  breakdown: unknown
}

const MAX_FUTURE_SKEW_SEC = 60 * 60
const OUTLIER_SPIKE_RATIO = 4
const OUTLIER_DROP_RATIO = 0.25

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function toDateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86400 * 1000)
}

function sanitizeCryptoSeries(
  snapshots: Array<{ createdAt: Date; totalValue: number }>,
  nowSec: number,
): CryptoPoint[] {
  const byTimestamp = new Map<number, number>()
  const futureCutoff = nowSec + MAX_FUTURE_SKEW_SEC

  for (const snapshot of snapshots) {
    const timestamp = Math.floor(snapshot.createdAt.getTime() / 1000)
    const value = snapshot.totalValue

    if (!Number.isFinite(timestamp) || !Number.isFinite(value)) continue
    if (timestamp <= 0 || value <= 0) continue
    if (timestamp > futureCutoff) continue

    byTimestamp.set(timestamp, value)
  }

  const sorted = Array.from(byTimestamp.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, value]) => ({ timestamp, value }))

  if (sorted.length < 3) return sorted

  const removed = new Set<number>()
  for (let i = 1; i < sorted.length - 1; i++) {
    const prev = sorted[i - 1].value
    const curr = sorted[i].value
    const next = sorted[i + 1].value
    if (prev <= 0 || curr <= 0 || next <= 0) continue

    const isSpike = curr > prev * OUTLIER_SPIKE_RATIO && curr > next * OUTLIER_SPIKE_RATIO
    const isDrop = curr < prev * OUTLIER_DROP_RATIO && curr < next * OUTLIER_DROP_RATIO
    if (isSpike || isDrop) removed.add(sorted[i].timestamp)
  }

  return sorted.filter((point) => !removed.has(point.timestamp))
}

function toDailyCryptoMap(points: CryptoPoint[]): Map<string, number> {
  const map = new Map<string, { ts: number; value: number }>()
  for (const point of points) {
    const key = toDateKey(new Date(point.timestamp * 1000))
    const existing = map.get(key)
    if (!existing || point.timestamp > existing.ts) {
      map.set(key, { ts: point.timestamp, value: point.value })
    }
  }

  return new Map(Array.from(map.entries()).map(([key, value]) => [key, value.value]))
}

function rangeToDate(range: string): Date {
  const now = new Date()
  const start = new Date(now)

  switch (range as RangeKey) {
    case "1w":
      start.setDate(start.getDate() - 7)
      break
    case "1m":
      start.setMonth(start.getMonth() - 1)
      break
    case "3m":
      start.setMonth(start.getMonth() - 3)
      break
    case "6m":
      start.setMonth(start.getMonth() - 6)
      break
    case "1y":
      start.setFullYear(start.getFullYear() - 1)
      break
    case "all":
      return new Date(Date.UTC(2000, 0, 1))
    default:
      start.setFullYear(start.getFullYear() - 1)
      break
  }

  return start
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8010", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const range = searchParams.get("range") ?? "1y"
  const includeCrypto = searchParams.get("includeCrypto") === "true"
  const includeInvestments = searchParams.get("includeInvestments") !== "false"

  try {
    // Rebuild all snapshots from transaction history (includes today)
    await backfillHistoricalSnapshots(user.id)
    // Ensure today's snapshot exists even if there are no transactions yet
    await saveFinanceSnapshot(user.id)

    // One-time: fetch full Plaid history if we have Plaid institutions but no old transactions
    const plaidInstitutionCount = await db.financeInstitution.count({
      where: { userId: user.id, provider: "plaid", status: "active" },
    })

    if (plaidInstitutionCount > 0) {
      const sixtyDaysAgo = new Date()
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)

      const oldTransactionCount = await db.financeTransaction.count({
        where: { userId: user.id, provider: "plaid", date: { lt: sixtyDaysAgo } },
      })

      if (oldTransactionCount === 0) {
        try {
          await fetchFullPlaidHistory(user.id)
        } catch {
          // If deep fetch fails, still backfill from whatever transactions exist
          await backfillHistoricalSnapshots(user.id)
        }
      }
    }

    const startDate = startOfUtcDay(rangeToDate(range))
    const nowDay = startOfUtcDay(new Date())

    const fiatSnapshots = await db.financeSnapshot.findMany({
      where: { userId: user.id, date: { gte: startDate } },
      orderBy: { date: "asc" },
    })

    const fiatByDate = new Map<string, FiatPoint>()
    for (const snapshot of fiatSnapshots) {
      const key = toDateKey(snapshot.date)
      let parsed: unknown = {}
      try { parsed = JSON.parse(snapshot.breakdown) } catch { /* keep empty */ }
      fiatByDate.set(key, {
        fiatAssets: snapshot.totalAssets,
        fiatDebt: snapshot.totalDebt,
        fiatNetWorth: snapshot.netWorth,
        breakdown: parsed,
      })
    }

    let cryptoByDate = new Map<string, number>()
    if (includeCrypto) {
      const nowSec = Math.floor(Date.now() / 1000)
      const cryptoSnapshots = await db.portfolioSnapshot.findMany({
        where: { userId: user.id, createdAt: { gte: startDate } },
        orderBy: { createdAt: "asc" },
      })
      const sanitized = sanitizeCryptoSeries(cryptoSnapshots, nowSec)
      cryptoByDate = toDailyCryptoMap(sanitized)
    }

    const hasFiatData = fiatByDate.size > 0
    const hasCryptoData = includeCrypto && cryptoByDate.size > 0
    if (!hasFiatData && !hasCryptoData) {
      return NextResponse.json([])
    }

    const result: Array<{
      date: string
      fiatAssets: number
      fiatDebt: number
      fiatNetWorth: number
      cryptoValue: number
      totalNetWorth: number
      breakdown: unknown
    }> = []

    let cursor = startDate
    let lastFiat: FiatPoint | null = null
    let lastCryptoValue = 0

    while (cursor <= nowDay) {
      const key = toDateKey(cursor)
      const fiat = fiatByDate.get(key)
      if (fiat) lastFiat = fiat

      if (includeCrypto) {
        const crypto = cryptoByDate.get(key)
        if (typeof crypto === "number") lastCryptoValue = crypto
      }

      if (lastFiat || lastCryptoValue > 0) {
        const fiatPoint = lastFiat ?? {
          fiatAssets: 0,
          fiatDebt: 0,
          fiatNetWorth: 0,
          breakdown: {},
        }

        // When investments are excluded, subtract investment value from assets/net worth
        const investmentValue = includeInvestments
          ? 0
          : ((fiatPoint.breakdown as Record<string, number> | null)?.investment ?? 0)
        const adjAssets = fiatPoint.fiatAssets - investmentValue
        const adjNetWorth = fiatPoint.fiatNetWorth - investmentValue

        result.push({
          date: key,
          fiatAssets: adjAssets,
          fiatDebt: fiatPoint.fiatDebt,
          fiatNetWorth: adjNetWorth,
          cryptoValue: includeCrypto ? lastCryptoValue : 0,
          totalNetWorth: adjNetWorth + (includeCrypto ? lastCryptoValue : 0),
          breakdown: fiatPoint.breakdown,
        })
      }

      cursor = addUtcDays(cursor, 1)
    }

    return NextResponse.json(result)
  } catch (err) {
    return apiError("F8011", "Failed to fetch snapshots", 500, err)
  }
}
