export interface BillingUrgency {
  label: string
  colorClass: string
  daysUntil: number
}

/** Advance a LOCAL-midnight date by one billing period in place. */
function advanceByFrequency(date: Date, frequency: string): void {
  switch (frequency) {
    case "weekly": date.setDate(date.getDate() + 7); break
    case "biweekly": date.setDate(date.getDate() + 14); break
    case "quarterly": date.setMonth(date.getMonth() + 3); break
    case "semi_annual": date.setMonth(date.getMonth() + 6); break
    case "yearly": date.setFullYear(date.getFullYear() + 1); break
    case "monthly": default: date.setMonth(date.getMonth() + 1); break
  }
}

export function getBillingUrgency(nextChargeDate: string, frequency?: string): BillingUrgency {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  // Parse "YYYY-MM-DD" as LOCAL midnight. `new Date("2026-06-21")` parses as UTC,
  // which is the previous day in any timezone west of UTC → bills showed "Due
  // today" a day early. Build from parts so it lands on local midnight directly.
  const [y, m, d] = nextChargeDate.split("T")[0].split("-").map(Number)
  const next = new Date(y, m - 1, d)
  // The stored next-charge date is often stale (never advanced past the last paid
  // period). Roll it forward to the next FUTURE occurrence so an old monthly date
  // doesn't read as "Due today". Guard bounds the loop.
  if (frequency) {
    let guard = 0
    while (next < now && guard++ < 240) advanceByFrequency(next, frequency)
  }
  const days = Math.round((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (days <= 0) {
    return { label: "Due today", colorClass: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10", daysUntil: days }
  }
  if (days === 1) {
    return { label: "Due tomorrow", colorClass: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10", daysUntil: days }
  }
  if (days <= 3) {
    return { label: `Due in ${days} days`, colorClass: "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-500/10", daysUntil: days }
  }
  if (days <= 7) {
    return { label: `Due in ${days} days`, colorClass: "text-amber-600 bg-amber-50 dark:text-amber-500 dark:bg-amber-500/10", daysUntil: days }
  }
  if (days <= 30) {
    return { label: `Due in ${days} days`, colorClass: "text-foreground-muted bg-background-secondary/50", daysUntil: days }
  }
  const formatted = next.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  return { label: `Next: ${formatted}`, colorClass: "text-foreground-muted", daysUntil: days }
}
