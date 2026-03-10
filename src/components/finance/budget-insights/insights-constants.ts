export const VERDICT_STYLES = {
  "well-aligned": { label: "Aligned", bg: "bg-success/10", text: "text-success", icon: "check_circle" },
  "under-budgeted": { label: "Under-budgeted", bg: "bg-error/10", text: "text-error", icon: "arrow_downward" },
  "over-budgeted": { label: "Over-budgeted", bg: "bg-warning/10", text: "text-warning", icon: "arrow_upward" },
  "missing": { label: "No Budget", bg: "bg-foreground-muted/10", text: "text-foreground-muted", icon: "add_circle" },
} as const

export const IMPACT_STYLES = {
  high: "bg-error/10 text-error",
  medium: "bg-warning/10 text-warning",
  low: "bg-primary/10 text-primary",
} as const

export type VerdictKey = keyof typeof VERDICT_STYLES
export type ImpactKey = keyof typeof IMPACT_STYLES
