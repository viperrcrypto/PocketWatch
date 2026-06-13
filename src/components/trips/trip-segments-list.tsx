"use client"

import type { TripSegment } from "@/hooks/use-trips"
import { SEGMENT_META, formatSegmentTime } from "./trip-helpers"

interface TripSegmentsListProps {
  segments: TripSegment[]
}

export function TripSegmentsList({ segments }: TripSegmentsListProps) {
  if (segments.length === 0) {
    return (
      <div className="card p-6 text-center">
        <span
          className="material-symbols-rounded text-foreground-muted/30 mb-2 block"
          style={{ fontSize: 32 }}
          aria-hidden="true"
        >
          luggage
        </span>
        <p className="text-xs text-foreground-muted">No segments added to this trip yet.</p>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <h3 className="text-sm font-bold text-foreground mb-3">Itinerary</h3>
      <ul className="space-y-2">
        {segments.map((seg) => {
          const meta = SEGMENT_META[seg.type] ?? { icon: "circle" }
          const when = formatSegmentTime(seg.startAt)
          return (
            <li
              key={seg.id}
              className="flex items-start gap-3 py-2 border-b border-card-border last:border-0"
            >
              <span
                className="material-symbols-rounded text-foreground-muted flex-shrink-0 mt-0.5"
                style={{ fontSize: 18 }}
                aria-hidden="true"
              >
                {meta.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{seg.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-foreground-muted mt-0.5">
                  <span className="capitalize">{seg.type}</span>
                  {seg.location && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{seg.location}</span>
                    </>
                  )}
                </div>
              </div>
              {when && (
                <span className="text-[11px] text-foreground-muted/70 tabular-nums flex-shrink-0">
                  {when}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
