/** Shared constants + date-range helper for the transactions page. */

export const DATE_PRESETS = [
  { key: "this-month", label: "This Month" },
  { key: "last-month", label: "Last Month" },
  { key: "3-months", label: "3M" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All" },
] as const

export function getDateRange(preset: string): { start?: string; end?: string } {
  const now = new Date()
  switch (preset) {
    case "this-month":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0] }
    case "last-month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { start: s.toISOString().split("T")[0], end: e.toISOString().split("T")[0] }
    }
    case "3-months":
      return { start: new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().split("T")[0] }
    case "ytd":
      return { start: new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0] }
    case "all":
    default:
      return {}
  }
}
