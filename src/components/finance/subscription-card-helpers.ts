export interface BillingUrgency {
  label: string
  colorClass: string
  daysUntil: number
}

export function getBillingUrgency(nextChargeDate: string): BillingUrgency {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const next = new Date(nextChargeDate)
  next.setHours(0, 0, 0, 0)
  const days = Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

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
