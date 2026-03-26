"use client"

import { usePortfolioSettings, useUpdateSettings } from "@/hooks/portfolio/use-services"
import { toast } from "sonner"

const AUTO_LOCK_OPTIONS = [
  { value: 0, label: "Off" },
  { value: 1, label: "1m" },
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h" },
] as const

const TOAST_LABELS: Record<number, string> = {
  0: "Auto-lock disabled",
  1: "Auto-lock set to 1 minute",
  5: "Auto-lock set to 5 minutes",
  15: "Auto-lock set to 15 minutes",
  30: "Auto-lock set to 30 minutes",
  60: "Auto-lock set to 1 hour",
}

const DEFAULT_AUTO_LOCK_MINUTES = 5

export function AutoLockSetting() {
  const { data: portfolioSettings, isLoading } = usePortfolioSettings()
  const updateSettings = useUpdateSettings()

  const currentValue =
    portfolioSettings?.settings?.autoLockMinutes ?? DEFAULT_AUTO_LOCK_MINUTES

  if (isLoading) {
    return <div className="p-5"><div className="h-10 animate-shimmer rounded-lg" /></div>
  }

  const handleSelect = (value: number) => {
    if (value === currentValue) return
    updateSettings.mutate(
      { autoLockMinutes: value },
      {
        onSuccess: () => toast.success(TOAST_LABELS[value]),
        onError: (err) => toast.error(err.message),
      },
    )
  }

  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Auto-Lock</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            Automatically lock the app after a period of inactivity
          </p>
        </div>
        <div className="flex items-center gap-0.5 bg-background-secondary border border-card-border p-0.5 rounded-lg shrink-0">
          {AUTO_LOCK_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSelect(opt.value)}
              disabled={updateSettings.isPending}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all duration-150 disabled:opacity-50 ${
                currentValue === opt.value
                  ? "bg-primary text-white shadow-sm"
                  : "bg-transparent text-foreground-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
