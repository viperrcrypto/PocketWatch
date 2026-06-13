"use client"

import { formatCurrency } from "@/lib/utils"
import type { TripSegment } from "@/hooks/use-trips"

interface TripPointsCardProps {
  segments: TripSegment[]
}

interface SegmentPoints {
  id: string
  title: string
  pointsUsed?: number
  pointsProgram?: string
  cashPaid?: number
  currency: string
}

const ISO_CURRENCY = /^[A-Z]{3}$/

/** Pull points/cash details off a segment's untyped `details` JSON. */
function readPoints(segment: TripSegment): SegmentPoints | null {
  const d = segment.details
  if (!d || typeof d !== "object") return null
  const rec = d as Record<string, unknown>
  const pointsUsed = typeof rec.pointsUsed === "number" && rec.pointsUsed > 0 ? rec.pointsUsed : undefined
  const cashPaid = typeof rec.cashPaid === "number" && rec.cashPaid > 0 ? rec.cashPaid : undefined
  if (pointsUsed === undefined && cashPaid === undefined) return null
  // `details` is untyped JSON of mixed provenance — guard the currency so a bad
  // code can never reach Intl.NumberFormat (which throws RangeError on non-ISO).
  const rawCurrency = typeof rec.currency === "string" ? rec.currency.toUpperCase() : ""
  return {
    id: segment.id,
    title: segment.title,
    pointsUsed,
    pointsProgram: typeof rec.pointsProgram === "string" ? rec.pointsProgram : undefined,
    cashPaid,
    currency: ISO_CURRENCY.test(rawCurrency) ? rawCurrency : "USD",
  }
}

export function TripPointsCard({ segments }: TripPointsCardProps) {
  const rows = segments.map(readPoints).filter((r): r is SegmentPoints => r !== null)
  if (rows.length === 0) return null

  const totalPoints = rows.reduce((sum, r) => sum + (r.pointsUsed ?? 0), 0)
  const cashRows = rows.filter((r) => r.cashPaid !== undefined)
  const currencies = new Set(cashRows.map((r) => r.currency))
  // Only sum cash when every cash row shares one currency — a blended figure is meaningless.
  const totalCash = currencies.size === 1 ? cashRows.reduce((sum, r) => sum + (r.cashPaid ?? 0), 0) : null
  const cashCurrency = cashRows[0]?.currency ?? "USD"

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-foreground">Points & Cash</h3>
        <span
          className="material-symbols-rounded text-foreground-muted/40"
          style={{ fontSize: 18 }}
          aria-hidden="true"
        >
          loyalty
        </span>
      </div>

      <div className="flex items-baseline gap-4">
        {totalPoints > 0 && (
          <div>
            <p className="text-2xl font-data font-black tabular-nums text-foreground" style={{ letterSpacing: "-0.02em" }}>
              {totalPoints.toLocaleString()}
            </p>
            <p className="text-[11px] text-foreground-muted">points used</p>
          </div>
        )}
        {totalCash !== null && totalCash > 0 && (
          <div>
            <p className="text-lg font-data font-bold tabular-nums text-foreground">
              {formatCurrency(totalCash, cashCurrency, 2)}
            </p>
            <p className="text-[11px] text-foreground-muted">cash / taxes</p>
          </div>
        )}
      </div>

      <ul className="mt-3 space-y-1.5 border-t border-card-border/40 pt-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-foreground-muted truncate">{r.title}</span>
            <span className="font-data tabular-nums text-foreground flex-shrink-0">
              {r.pointsUsed ? `${r.pointsUsed.toLocaleString()} pts` : ""}
              {r.pointsUsed && r.cashPaid ? " · " : ""}
              {r.cashPaid ? formatCurrency(r.cashPaid, r.currency, 2) : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
