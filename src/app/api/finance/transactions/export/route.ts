import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

const EXPORT_LIMIT = 10000

const CSV_HEADER = [
  "Date",
  "Name",
  "Merchant",
  "Amount",
  "Currency",
  "Category",
  "Account",
  "Pending",
] as const

/**
 * CSV-escape a single field: stringify, wrap in double quotes, double internal
 * quotes. For TEXT fields, also neutralize spreadsheet formula injection — Plaid
 * merchant names are externally controlled, so a value like "=HYPERLINK(...)"
 * must not become a live formula. Numbers are untouched so amount keeps its "-".
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '""'
  let str = String(value)
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return `"${str.replace(/"/g, '""')}"`
}

function toCsvRow(fields: readonly unknown[]): string {
  return fields.map(csvEscape).join(",")
}

function formatDate(date: Date): string {
  // YYYY-MM-DD (date column is stored as @db.Date)
  return date.toISOString().slice(0, 10)
}

/**
 * GET /api/finance/transactions/export
 *
 * Exports the vault owner's finance transactions as a downloadable CSV
 * (data portability). Scoped to the authenticated user, ordered newest-first,
 * with a generous but bounded row cap.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F4051", "Authentication required", 401)

  try {
    const transactions = await db.financeTransaction.findMany({
      where: { userId: user.id, isDuplicate: false, isExcluded: false },
      orderBy: { date: "desc" },
      take: EXPORT_LIMIT,
      select: {
        date: true,
        name: true,
        merchantName: true,
        amount: true,
        currency: true,
        category: true,
        isPending: true,
        account: { select: { name: true, mask: true } },
      },
    })

    const rows = transactions.map((tx) => {
      const accountLabel = tx.account
        ? tx.account.mask
          ? `${tx.account.name} (${tx.account.mask})`
          : tx.account.name
        : ""
      return toCsvRow([
        formatDate(tx.date),
        tx.name,
        tx.merchantName ?? "",
        tx.amount,
        tx.currency,
        tx.category ?? "",
        accountLabel,
        tx.isPending ? "yes" : "no",
      ])
    })

    // Lead with a UTF-8 BOM so Excel renders accented merchant names correctly.
    const csv = "﻿" + [toCsvRow(CSV_HEADER), ...rows].join("\r\n")

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="pocketwatch-transactions.csv"',
        "Cache-Control": "private, no-store",
      },
    })
  } catch (error) {
    return apiError("F4052", "Failed to export transactions", 500, error)
  }
}
