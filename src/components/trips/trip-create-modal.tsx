"use client"

import { useState } from "react"
import type { CreateTripInput, TripStatus } from "@/hooks/use-trips"
import { STATUS_META } from "./trip-helpers"

interface TripCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (input: CreateTripInput) => void
  isPending: boolean
}

const STATUSES: TripStatus[] = ["upcoming", "active", "past"]

export function TripCreateModal({ isOpen, onClose, onCreate, isPending }: TripCreateModalProps) {
  const [name, setName] = useState("")
  const [destination, setDestination] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [status, setStatus] = useState<TripStatus>("upcoming")

  const canSubmit = name.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(startDate)

  const reset = () => {
    setName("")
    setDestination("")
    setStartDate("")
    setEndDate("")
    setStatus("upcoming")
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    onCreate({
      name: name.trim(),
      startDate,
      status,
      ...(destination.trim() ? { destination: destination.trim() } : {}),
      ...(endDate ? { endDate } : {}),
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="trip-modal-title"
        className="bg-card border border-card-border w-full max-w-md rounded-2xl overflow-hidden max-h-[90dvh] flex flex-col"
        style={{ boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border flex-shrink-0">
          <h2 id="trip-modal-title" className="text-base font-semibold text-foreground">
            New Trip
          </h2>
          <button
            onClick={handleClose}
            className="touch-target rounded-md hover:bg-foreground/5 transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>
              close
            </span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}>
          <Field label="Name" htmlFor="trip-name">
            <input
              id="trip-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Summer in Lisbon"
              maxLength={120}
              autoFocus
              className="trip-input"
            />
          </Field>

          <Field label="Destination" htmlFor="trip-dest" optional>
            <input
              id="trip-dest"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Lisbon, Portugal"
              maxLength={120}
              className="trip-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date" htmlFor="trip-start">
              <input
                id="trip-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="trip-input"
              />
            </Field>
            <Field label="End date" htmlFor="trip-end" optional>
              <input
                id="trip-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="trip-input"
              />
            </Field>
          </div>

          <Field label="Status" htmlFor="trip-status">
            <div className="grid grid-cols-3 gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    status === s
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-card-border text-foreground-muted hover:text-foreground"
                  }`}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
                    {STATUS_META[s].icon}
                  </span>
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div className="px-6 py-4 border-t border-card-border flex-shrink-0 flex justify-end gap-2">
          <button onClick={handleClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={!canSubmit || isPending} className="btn-primary">
            {isPending ? "Creating…" : "Create Trip"}
          </button>
        </div>
      </div>

      <style jsx>{`
        :global(.trip-input) {
          width: 100%;
          background: var(--background-secondary);
          border: 1px solid var(--card-border);
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.8125rem;
          color: var(--foreground);
          outline: none;
        }
        :global(.trip-input:focus) {
          border-color: var(--primary);
        }
      `}</style>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string
  htmlFor: string
  optional?: boolean
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground-muted mb-1.5">
        {label}
        {optional && <span className="text-foreground-muted/50"> (optional)</span>}
      </label>
      {children}
    </div>
  )
}
