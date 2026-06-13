import { computeNextChargeDate, type Frequency } from "@/lib/finance/subscriptions"
import type { BillItem } from "./bills-calendar"

/** Map frequency to a dot color class */
export function freqDotColor(freq: string): string {
  switch (freq) {
    case "weekly": return "bg-violet-400"
    case "biweekly": return "bg-cyan-400"
    case "monthly": return "bg-blue-400"
    case "quarterly": return "bg-amber-400"
    case "semi_annual": return "bg-orange-400"
    case "yearly": return "bg-rose-400"
    default: return "bg-foreground-muted/40"
  }
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500",
  "bg-teal-500", "bg-orange-500", "bg-fuchsia-500", "bg-lime-500",
]

/** Generate a stable color from merchant name for the avatar */
export function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function merchantInitials(name: string): string {
  const cleaned = name.replace(/\s*••••\d+$/, "").trim()
  const words = cleaned.split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

export function projectBillsToMonth(bills: BillItem[], year: number, month: number): Map<number, BillItem[]> {
  const dayMap = new Map<number, BillItem[]>()
  for (const bill of bills) {
    // Work in UTC end-to-end: computeNextChargeDate produces UTC-midnight dates,
    // so building/reading with UTC keeps the projected day exact (and avoids the
    // ±1-day drift that local getters would accumulate each iteration).
    const [y, m, d] = bill.nextDueDate.split("-").map(Number)
    let date = new Date(Date.UTC(y, m - 1, d))
    let iterations = 0
    while ((date.getUTCFullYear() < year || (date.getUTCFullYear() === year && date.getUTCMonth() < month)) && iterations < 24) {
      date = computeNextChargeDate(date, bill.frequency as Frequency)
      iterations++
    }
    if (date.getUTCFullYear() > year || (date.getUTCFullYear() === year && date.getUTCMonth() > month)) continue
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month) {
      const day = date.getUTCDate()
      const existing = dayMap.get(day) ?? []
      // If bill was projected forward (date changed), isPaid no longer applies
      const projectedBill = iterations > 0 ? { ...bill, isPaid: false } : bill
      dayMap.set(day, [...existing, projectedBill])
    }
  }
  return dayMap
}

export interface CalendarCell { day: number | null; isTrailing?: boolean }

export function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()
  const cells: CalendarCell[] = []
  if (firstDayOfWeek > 0) {
    const prevMonthDays = new Date(year, month, 0).getDate()
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      cells.push({ day: prevMonthDays - i, isTrailing: true })
    }
  }
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d })
  const remaining = 7 - (cells.length % 7)
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) cells.push({ day: d, isTrailing: true })
  }
  return cells
}
