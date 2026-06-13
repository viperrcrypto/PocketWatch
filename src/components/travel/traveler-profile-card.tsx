"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import {
  useTravelerProfile,
  useSaveTravelerProfile,
  type TravelerProfileInput,
} from "@/hooks/travel/use-traveler-profile"
import type { LoyaltyProgram, SeatPreference, CabinPreference } from "@/lib/travel/traveler-profile"

const SEAT_OPTIONS: { value: SeatPreference; label: string }[] = [
  { value: "no_preference", label: "No preference" },
  { value: "window", label: "Window" },
  { value: "aisle", label: "Aisle" },
]

const CABIN_OPTIONS: { value: CabinPreference; label: string }[] = [
  { value: "ECON", label: "Economy" },
  { value: "PREM_ECON", label: "Premium Economy" },
  { value: "BIZ", label: "Business" },
  { value: "FIRST", label: "First" },
]

const inputClass =
  "w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"

export function TravelerProfileCard() {
  const { data, isLoading } = useTravelerProfile()
  const saveMutation = useSaveTravelerProfile()

  const [loyalty, setLoyalty] = useState<LoyaltyProgram[]>([])
  const [ktn, setKtn] = useState("")
  const [passport, setPassport] = useState("")
  const [passportExpiry, setPassportExpiry] = useState("")
  const [seat, setSeat] = useState<SeatPreference>("no_preference")
  const [cabin, setCabin] = useState<CabinPreference | "">("")

  // Hydrate from the server. Masked identity numbers are NOT placed in the
  // editable fields — they stay empty so a blank save doesn't wipe stored
  // values; the masked preview is shown beneath each field instead.
  useEffect(() => {
    if (!data?.profile) return
    setLoyalty(data.profile.loyaltyPrograms ?? [])
    setSeat(data.profile.seatPreference ?? "no_preference")
    setCabin(data.profile.cabinPreference ?? "")
    setPassportExpiry(data.profile.passportExpiry ?? "")
  }, [data])

  const addProgram = () => setLoyalty((prev) => [...prev, { program: "", number: "" }])
  const removeProgram = (idx: number) =>
    setLoyalty((prev) => prev.filter((_, i) => i !== idx))
  const updateProgram = (idx: number, patch: Partial<LoyaltyProgram>) =>
    setLoyalty((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)))

  const handleSave = async () => {
    const payload: TravelerProfileInput = {
      loyaltyPrograms: loyalty.filter((p) => p.program.trim() || p.number.trim()),
      seatPreference: seat,
      ...(cabin ? { cabinPreference: cabin } : {}),
      ...(passportExpiry ? { passportExpiry } : {}),
      // Only send identity numbers when the user typed a new value, so an
      // untouched (masked) field never overwrites the stored secret.
      ...(ktn.trim() ? { knownTravelerNumber: ktn.trim() } : {}),
      ...(passport.trim() ? { passportNumber: passport.trim() } : {}),
    }
    try {
      await saveMutation.mutateAsync(payload)
      setKtn("")
      setPassport("")
      toast.success("Traveler profile saved")
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="card p-6 text-center">
        <span className="material-symbols-rounded animate-spin text-foreground-muted" style={{ fontSize: 24 }}>
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>badge</span>
        <h3 className="text-sm font-bold text-foreground">Traveler Profile</h3>
      </div>
      <p className="text-xs text-foreground-muted">
        Stored encrypted at rest. Passport and Known Traveler numbers are masked
        when displayed — leave a field blank to keep the saved value.
      </p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Loyalty Programs</label>
          <button onClick={addProgram} className="text-xs text-primary hover:underline">+ Add</button>
        </div>
        {loyalty.length === 0 && (
          <p className="text-[10px] text-foreground-muted">No programs added.</p>
        )}
        {loyalty.map((p, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              value={p.program}
              onChange={(e) => updateProgram(idx, { program: e.target.value })}
              placeholder="Program (e.g. United MileagePlus)"
              className={inputClass}
            />
            <input
              value={p.number}
              onChange={(e) => updateProgram(idx, { number: e.target.value })}
              placeholder="Member #"
              className={cn(inputClass, "font-mono")}
            />
            <button
              onClick={() => removeProgram(idx)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 shrink-0"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Known Traveler # (TSA/Global Entry)</label>
          <input
            value={ktn}
            onChange={(e) => setKtn(e.target.value)}
            placeholder={data?.profile?.knownTravelerNumber ?? "Enter KTN"}
            className={cn(inputClass, "font-mono")}
          />
          {data?.profile?.hasKnownTravelerNumber && (
            <p className="text-[10px] text-foreground-muted">Saved: {data.profile.knownTravelerNumber}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Passport Number</label>
          <input
            value={passport}
            onChange={(e) => setPassport(e.target.value)}
            placeholder={data?.profile?.passportNumber ?? "Enter passport #"}
            className={cn(inputClass, "font-mono")}
          />
          {data?.profile?.hasPassportNumber && (
            <p className="text-[10px] text-foreground-muted">Saved: {data.profile.passportNumber}</p>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Passport Expiry</label>
          <input
            type="date"
            value={passportExpiry}
            onChange={(e) => setPassportExpiry(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Seat Preference</label>
          <select
            value={seat}
            onChange={(e) => setSeat(e.target.value as SeatPreference)}
            className={inputClass}
          >
            {SEAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-foreground">Cabin Preference</label>
          <select
            value={cabin}
            onChange={(e) => setCabin(e.target.value as CabinPreference | "")}
            className={inputClass}
          >
            <option value="">No default</option>
            {CABIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className={cn(
          "px-4 py-2 rounded-lg text-xs font-medium transition-colors",
          saveMutation.isPending ? "bg-card-border text-foreground-muted cursor-not-allowed" : "btn-primary",
        )}
      >
        {saveMutation.isPending ? "Saving..." : "Save Profile"}
      </button>
    </div>
  )
}
