"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  useTrips,
  useCreateTrip,
  useGmailAccounts,
  useSyncGmail,
  type CreateTripInput,
} from "@/hooks/use-trips"
import { FinancePageHeader } from "@/components/finance/finance-page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { TripsTabs } from "@/components/trips/trips-tabs"
import { TripCreateModal } from "@/components/trips/trip-create-modal"
import { GmailAccountsBar } from "@/components/trips/gmail-accounts-bar"

export default function TripsPage() {
  const { data: trips, isLoading, isError } = useTrips()
  const { data: gmailAccounts } = useGmailAccounts()
  const createTrip = useCreateTrip()
  const syncGmail = useSyncGmail()
  const [showModal, setShowModal] = useState(false)

  const hasTrips = (trips?.length ?? 0) > 0
  const hasGmail = (gmailAccounts?.length ?? 0) > 0

  const handleCreate = (input: CreateTripInput) => {
    createTrip.mutate(input, {
      onSuccess: () => {
        setShowModal(false)
        toast.success("Trip created")
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create trip"),
    })
  }

  const handleSync = () => {
    syncGmail.mutate(undefined, {
      onSuccess: (result) => {
        toast.success(
          result.imported > 0
            ? `Imported ${result.imported} trip${result.imported === 1 ? "" : "s"} from Gmail`
            : "No new trips found in Gmail",
        )
      },
      onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to sync from Gmail"),
    })
  }

  return (
    <div className="py-6 space-y-6">
      <FinancePageHeader
        title="Trips"
        subtitle="Plan trips and track what you spend on each one"
        actions={
          <div className="flex items-center gap-2">
            {hasGmail ? (
              <button
                onClick={handleSync}
                disabled={syncGmail.isPending}
                className="btn-secondary"
              >
                <span
                  className={`material-symbols-rounded ${syncGmail.isPending ? "animate-spin" : ""}`}
                  style={{ fontSize: 16 }}
                  aria-hidden="true"
                >
                  {syncGmail.isPending ? "progress_activity" : "sync"}
                </span>
                {syncGmail.isPending ? "Syncing…" : "Sync from Gmail"}
              </button>
            ) : (
              <a href="/api/integrations/gmail/connect" className="btn-secondary">
                <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
                  mail
                </span>
                Connect Gmail
              </a>
            )}
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <span className="material-symbols-rounded" style={{ fontSize: 16 }} aria-hidden="true">
                add
              </span>
              New Trip
            </button>
          </div>
        }
      />

      {hasGmail && <GmailAccountsBar accounts={gmailAccounts ?? []} />}

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card p-4 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {isError && !isLoading && (
        <div className="card p-4 border-l-4" style={{ borderLeftColor: "var(--error)" }}>
          <p className="text-sm font-medium text-foreground">Couldn&apos;t load trips</p>
          <p className="text-xs text-foreground-muted mt-1">Please refresh and try again.</p>
        </div>
      )}

      {!isLoading && !isError && !hasTrips && (
        <EmptyState
          icon="luggage"
          title="No trips yet"
          description="Create your first trip to organize segments and track tagged spend in one place."
          action={{ label: "New Trip", onClick: () => setShowModal(true) }}
        />
      )}

      {!isLoading && !isError && hasTrips && <TripsTabs trips={trips ?? []} />}

      <TripCreateModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onCreate={handleCreate}
        isPending={createTrip.isPending}
      />
    </div>
  )
}
