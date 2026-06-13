"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { SearchConfig } from "@/types/travel"
import { useSavedRoutes, useCreateSavedRoute, useDeleteSavedRoute } from "@/hooks/travel"

interface SavedRoutesPanelProps {
  /** The current search, enabling a one-tap "track this route" affordance. */
  currentConfig?: SearchConfig | null
}

export function SavedRoutesPanel({ currentConfig }: SavedRoutesPanelProps) {
  const { data } = useSavedRoutes()
  const create = useCreateSavedRoute()
  const del = useDeleteSavedRoute()
  const [threshold, setThreshold] = useState("")

  const routes = data?.routes ?? []

  const handleTrack = () => {
    if (!currentConfig) return
    const t = threshold.trim() ? Number(threshold) : undefined
    create.mutate(
      {
        origin: currentConfig.origin,
        destination: currentConfig.destination,
        departureDate: currentConfig.departureDate,
        returnDate: currentConfig.returnDate,
        tripType: currentConfig.tripType === "round_trip" ? "round_trip" : "one_way",
        searchClass: currentConfig.searchClass,
        alertThreshold: t !== undefined && Number.isFinite(t) && t > 0 ? t : undefined,
        thresholdType: "cash",
      },
      {
        onSuccess: () => {
          setThreshold("")
          toast.success("Route tracked — we'll alert you on price drops")
        },
        onError: () => toast.error("Couldn't track this route"),
      },
    )
  }

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-1.5">
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>notifications_active</span>
        Tracked Routes
      </h3>

      {currentConfig && (
        <div className="mb-3 pb-3 border-b" style={{ borderColor: "var(--card-border)" }}>
          <p className="text-[11px] text-foreground-muted mb-1.5">
            Track {currentConfig.origin}→{currentConfig.destination} for price drops
          </p>
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">$</span>
              <input
                type="number"
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                placeholder="Alert below"
                className="w-full pl-5 pr-2 py-1.5 text-xs rounded-md bg-background-secondary border text-foreground"
                style={{ borderColor: "var(--card-border)" }}
              />
            </div>
            <button
              onClick={handleTrack}
              disabled={create.isPending}
              className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap disabled:opacity-50"
            >
              {create.isPending ? "…" : "Track"}
            </button>
          </div>
        </div>
      )}

      {routes.length === 0 ? (
        <p className="text-xs text-foreground-muted">
          No tracked routes yet. Search a route and tap Track to get price-drop alerts.
        </p>
      ) : (
        <div className="space-y-2">
          {routes.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {r.origin}→{r.destination}
                </p>
                <p className="text-[11px] text-foreground-muted truncate">
                  {r.departureDate}
                  {r.alertThreshold ? ` · alert < $${r.alertThreshold}` : ""}
                  {r.lastPrice ? ` · last $${Math.round(r.lastPrice)}` : ""}
                </p>
              </div>
              <button
                onClick={() => del.mutate(r.id)}
                disabled={del.isPending}
                aria-label={`Stop tracking ${r.origin} to ${r.destination}`}
                className="text-foreground-muted hover:text-red-400 shrink-0 transition-colors"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
