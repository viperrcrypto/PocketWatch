import type { CategoryMeta } from "@/lib/finance/categories"

export function GradIcon({ meta, size = 32, icon = 15 }: { meta: CategoryMeta; size?: number; icon?: number }) {
  return (
    <span className="material-symbols-rounded flex-shrink-0" style={{ fontSize: icon + 2, color: meta.hex }}>{meta.icon}</span>
  )
}

export function formatMonthLabel(monthStr: string): string {
  const [year, month] = monthStr.split("-")
  const date = new Date(Number(year), Number(month) - 1)
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" })
}

export function formatDateLabel(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
