"use client"

import { use, useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { useTrip, useDeleteTrip, useTagTripExpenses } from "@/hooks/use-trips"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { TripSegmentsList } from "@/components/trips/trip-segments-list"
import { TripSpendCard } from "@/components/trips/trip-spend-card"
import { TripPointsCard } from "@/components/trips/trip-points-card"
import { TravelDayCard } from "@/components/trips/travel-day-card"
import { STATUS_META, formatTripDates } from "@/components/trips/trip-helpers"

interface TripDetailPageProps {
  params: Promise<{ id: string }>
}

export default function TripDetailPage({ params }: TripDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { data, isLoading, isError } = useTrip(id)
  const deleteTrip = useDeleteTrip()
  const tagExpenses = useTagTripExpenses()
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Auto-tag card spending in the trip's date window the first time the trip is
  // opened, so Trip Spend just works without the manual button. The server only
  // tags UNtagged transactions (tripId: null), so this never steals from another
  // trip; runs once per mount.
  const autoTagged = useRef(false)
  useEffect(() => {
    if (data && data.spend.count === 0 && !autoTagged.current && !tagExpenses.isPending) {
      autoTagged.current = true
      tagExpenses.mutate(id)
    }
  }, [data, id, tagExpenses])

  const handleTagExpenses = () => {
    tagExpenses.mutate(id, {
      onSuccess: () => toast.success("Tagged transactions in this trip's dates"),
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to tag expenses"),
    })
  }

  const handleDelete = () => {
    deleteTrip.mutate(id, {
      onSuccess: () => {
        toast.success("Trip deleted")
        router.push("/trips")
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to delete trip"),
    })
  }

  if (isLoading) {
    return (
      <div className="py-6 space-y-6">
        <div className="card p-4 h-20 animate-pulse" />
        <div className="card p-4 h-40 animate-pulse" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="py-6 space-y-4">
        <BackLink />
        <div className="card p-6 text-center">
          <span
            className="material-symbols-rounded text-foreground-muted/30 mb-2 block"
            style={{ fontSize: 32 }}
            aria-hidden="true"
          >
            error
          </span>
          <p className="text-sm text-foreground-muted">This trip could not be found.</p>
        </div>
      </div>
    )
  }

  const { trip, spend, taggedTransactions } = data
  const status = STATUS_META[trip.status]

  return (
    <div className="py-6 space-y-6">
      <BackLink />

      <FinancePageHeader
        title={trip.name}
        subtitle={
          <span className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
              style={{ color: status.color, background: `${status.color}1a` }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 12 }} aria-hidden="true">
                {status.icon}
              </span>
              {status.label}
            </span>
            <span className="tabular-nums">{formatTripDates(trip.startDate, trip.endDate)}</span>
            {trip.destination && <span>· {trip.destination}</span>}
          </span>
        }
        actions={
          confirmDelete ? (
            <div className="flex items-center gap-2">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteTrip.isPending}
                className="btn-secondary"
                style={{ color: "var(--error)" }}
              >
                {deleteTrip.isPending ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="btn-secondary"
              aria-label="Delete trip"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
                delete
              </span>
              Delete
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <div className="space-y-6 min-w-0">
          <TripSegmentsList segments={trip.segments} />
          {trip.notes && (
            <div className="card p-4">
              <h3 className="text-sm font-bold text-foreground mb-2">Notes</h3>
              <p className="text-sm text-foreground-muted whitespace-pre-wrap leading-relaxed">
                {trip.notes}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <TravelDayCard tripId={id} />
          <TripSpendCard spend={spend} taggedTransactions={taggedTransactions} tripId={id} />
          <TripPointsCard segments={trip.segments} />
          <button
            onClick={handleTagExpenses}
            disabled={tagExpenses.isPending}
            className="btn-secondary w-full text-xs flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">sell</span>
            {tagExpenses.isPending ? "Tagging…" : "Tag transactions in trip dates"}
          </button>
        </div>
      </div>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/trips"
      className="inline-flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
    >
      <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
        arrow_back
      </span>
      All trips
    </Link>
  )
}
