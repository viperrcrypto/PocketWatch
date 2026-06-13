/**
 * Shared fetch helper and query key factory for Travel hooks.
 */

import { csrfHeaders } from "@/lib/csrf-client"

export async function travelFetch<T>(
  path: string,
  options?: RequestInit & { timeoutMs?: number },
): Promise<T> {
  const { timeoutMs = 60_000, ...fetchOptions } = options ?? {}
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`/api/travel${path}`, {
      ...fetchOptions,
      credentials: "include",
      // Mutations must carry the CSRF token, else the middleware 403s with
      // "CSRF token missing or invalid" (this broke saving the Roame session).
      headers: csrfHeaders({
        "Content-Type": "application/json",
        ...fetchOptions?.headers,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }

    return res.json() as Promise<T>
  } finally {
    clearTimeout(timeout)
  }
}

export const travelKeys = {
  all: ["travel"] as const,
  credentials: () => [...travelKeys.all, "credentials"] as const,
  balances: () => [...travelKeys.all, "balances"] as const,
  savedRoutes: () => [...travelKeys.all, "savedRoutes"] as const,
  profile: () => [...travelKeys.all, "profile"] as const,
  search: (origin: string, dest: string, date: string) =>
    [...travelKeys.all, "search", origin, dest, date] as const,
}
