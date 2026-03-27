/**
 * GET /api/finance/income/streams — Detect and return recurring income sources.
 * Analyzes 6 months of Income-category transactions, groups by merchant,
 * identifies frequency, and returns consistency metrics.
 */

import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

interface IncomeStream {
  merchantName: string
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly" | "quarterly" | "irregular"
  avgAmount: number
  lastAmount: number
  lastDate: string
  nextExpected: string | null
  monthCount: number
  totalReceived: number
  consistency: number // 0-1 ratio of how consistently it arrives
  status: "on_track" | "late" | "missed" | "new"
}

function detectFrequency(gaps: number[]): IncomeStream["frequency"] {
  if (gaps.length < 2) return "irregular"
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length
  if (avg <= 10) return "weekly"
  if (avg >= 12 && avg <= 18) return "biweekly"
  if (avg >= 13 && avg <= 17) return "semimonthly"
  if (avg >= 25 && avg <= 35) return "monthly"
  if (avg >= 80 && avg <= 100) return "quarterly"
  return "irregular"
}

function projectNextDate(lastDate: Date, frequency: IncomeStream["frequency"]): Date | null {
  const d = new Date(lastDate)
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); return d
    case "biweekly": d.setDate(d.getDate() + 14); return d
    case "semimonthly": d.setDate(d.getDate() + 15); return d
    case "monthly": d.setMonth(d.getMonth() + 1); return d
    case "quarterly": d.setMonth(d.getMonth() + 3); return d
    default: return null
  }
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("IS001", "Authentication required", 401)

  try {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const incomeTxs = await db.financeTransaction.findMany({
      where: {
        userId: user.id,
        category: "Income",
        amount: { lt: 0 },
        isDuplicate: false,
        isExcluded: false,
        date: { gte: sixMonthsAgo },
      },
      select: { merchantName: true, name: true, amount: true, date: true },
      orderBy: { date: "asc" },
    })

    // Group by merchant
    const byMerchant = new Map<string, Array<{ amount: number; date: Date }>>()
    for (const tx of incomeTxs) {
      const key = tx.merchantName ?? tx.name ?? "Unknown"
      const entries = byMerchant.get(key) ?? []
      entries.push({ amount: Math.abs(tx.amount), date: tx.date })
      byMerchant.set(key, entries)
    }

    const now = new Date()
    const streams: IncomeStream[] = []

    for (const [merchantName, entries] of byMerchant) {
      if (entries.length < 2) {
        // Single occurrence — show as "new" if recent
        const e = entries[0]
        const daysSince = (now.getTime() - e.date.getTime()) / (1000 * 60 * 60 * 24)
        if (daysSince <= 45) {
          streams.push({
            merchantName,
            frequency: "irregular",
            avgAmount: e.amount,
            lastAmount: e.amount,
            lastDate: e.date.toISOString(),
            nextExpected: null,
            monthCount: 1,
            totalReceived: e.amount,
            consistency: 0,
            status: "new",
          })
        }
        continue
      }

      // Sort by date and compute gaps
      entries.sort((a, b) => a.date.getTime() - b.date.getTime())
      const gaps: number[] = []
      for (let i = 1; i < entries.length; i++) {
        gaps.push((entries[i].date.getTime() - entries[i - 1].date.getTime()) / (1000 * 60 * 60 * 24))
      }

      const frequency = detectFrequency(gaps)
      const avgAmount = Math.round(entries.reduce((s, e) => s + e.amount, 0) / entries.length * 100) / 100
      const lastEntry = entries[entries.length - 1]
      const totalReceived = Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100

      // Count distinct months
      const months = new Set(entries.map((e) => `${e.date.getFullYear()}-${e.date.getMonth()}`))

      // Consistency: how many expected occurrences actually happened
      const expectedMonthlyCount = frequency === "weekly" ? 4 : frequency === "biweekly" ? 2 : frequency === "semimonthly" ? 2 : 1
      const expectedTotal = months.size * expectedMonthlyCount
      const consistency = Math.min(1, entries.length / Math.max(1, expectedTotal))

      // Project next date and determine status
      const nextDate = projectNextDate(lastEntry.date, frequency)
      let status: IncomeStream["status"] = "on_track"

      if (nextDate) {
        const daysPastDue = (now.getTime() - nextDate.getTime()) / (1000 * 60 * 60 * 24)
        if (daysPastDue > 7) status = "missed"
        else if (daysPastDue > 2) status = "late"
      }

      streams.push({
        merchantName,
        frequency,
        avgAmount,
        lastAmount: lastEntry.amount,
        lastDate: lastEntry.date.toISOString(),
        nextExpected: nextDate?.toISOString() ?? null,
        monthCount: months.size,
        totalReceived,
        consistency,
        status,
      })
    }

    // Sort: recurring first (by total received desc), then one-offs
    streams.sort((a, b) => {
      if (a.frequency === "irregular" && b.frequency !== "irregular") return 1
      if (a.frequency !== "irregular" && b.frequency === "irregular") return -1
      return b.totalReceived - a.totalReceived
    })

    // Summary stats
    const monthlyEstimate = streams
      .filter((s) => s.frequency !== "irregular")
      .reduce((sum, s) => {
        const multiplier = s.frequency === "weekly" ? 4.33 : s.frequency === "biweekly" ? 2.17 : s.frequency === "semimonthly" ? 2 : s.frequency === "quarterly" ? 1 / 3 : 1
        return sum + s.avgAmount * multiplier
      }, 0)

    return NextResponse.json({
      streams,
      summary: {
        totalSources: streams.length,
        recurringSources: streams.filter((s) => s.frequency !== "irregular").length,
        monthlyEstimate: Math.round(monthlyEstimate * 100) / 100,
        totalReceived6mo: Math.round(streams.reduce((s, st) => s + st.totalReceived, 0) * 100) / 100,
        lateOrMissed: streams.filter((s) => s.status === "late" || s.status === "missed").length,
      },
    })
  } catch (err) {
    return apiError("IS002", "Failed to analyze income streams", 500, err)
  }
}
