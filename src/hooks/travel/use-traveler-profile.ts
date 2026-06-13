/**
 * Traveler / loyalty profile hooks.
 *
 * GET returns identity numbers MASKED to last-4 (with has* flags), so the
 * read model differs from the save model. Mutations send CSRF headers.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { travelKeys } from "./shared"
import { csrfHeaders } from "@/lib/csrf-client"
import {
  type LoyaltyProgram,
  type SeatPreference,
  type CabinPreference,
} from "@/lib/travel/traveler-profile"

/** Read model — sensitive numbers are masked, presence exposed via has* flags. */
export interface MaskedTravelerProfile {
  loyaltyPrograms: LoyaltyProgram[]
  knownTravelerNumber?: string
  passportNumber?: string
  passportExpiry?: string
  seatPreference?: SeatPreference
  cabinPreference?: CabinPreference
  hasKnownTravelerNumber: boolean
  hasPassportNumber: boolean
}

/** Write model — full values round-trip to the server. */
export interface TravelerProfileInput {
  loyaltyPrograms: LoyaltyProgram[]
  knownTravelerNumber?: string
  passportNumber?: string
  passportExpiry?: string
  seatPreference?: SeatPreference
  cabinPreference?: CabinPreference
}

async function profileFetch<T>(options?: RequestInit): Promise<T> {
  const res = await fetch("/api/travel/profile", {
    ...options,
    credentials: "include",
    headers: csrfHeaders({ "Content-Type": "application/json", ...options?.headers }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useTravelerProfile() {
  return useQuery({
    queryKey: travelKeys.profile(),
    queryFn: () => profileFetch<{ profile: MaskedTravelerProfile }>(),
    // Don't refetch on focus — it would stomp the user's in-progress edits in the
    // profile form (which hydrates from this query).
    refetchOnWindowFocus: false,
  })
}

export function useSaveTravelerProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: TravelerProfileInput) =>
      profileFetch<{ saved: boolean; profile: MaskedTravelerProfile }>({
        method: "PUT",
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: travelKeys.profile() }),
  })
}
