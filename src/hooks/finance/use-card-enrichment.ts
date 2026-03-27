/**
 * Card AI enrichment, perk loading, and perk usage detection hooks.
 */

import { useState, useCallback } from "react"
import { csrfHeaders } from "@/lib/csrf-client"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { financeFetch, financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

interface CardPerk {
  id: string
  name: string
  value: number
  maxValue: number
  usedValue: number
  perkType: "limited" | "unlimited"
  period: "monthly" | "quarterly" | "annual" | "one_time"
  periodResetDay: number
  currentPeriodStart: string | null
  description: string | null
  isUsed: boolean
  usedDate: string | null
  percentUsed: number
  daysRemaining: number | null
  periodEnd: string | null
  periodLabel: string
  annualizedValue: number
}

interface ApplyEnrichmentResult {
  ratesCreated: number
  perksCreated: number
  baseRewardRate: number
}

interface PerkUsageMatch {
  perkId: string
  perkName: string
  matched: boolean
  matchCount: number
  totalAmount: number
}

export interface EnrichProgress {
  current: number
  total: number
  currentCardName?: string
  results: Array<{ cardId: string; cardName?: string; status: string; error?: string }>
}

// ─── Apply Enrichment (converts AI JSON → DB rows) ─────────────

export function useApplyEnrichment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { cardProfileId: string }) =>
      financeFetch<ApplyEnrichmentResult>("/cards/apply-enrichment", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.cards() })
      qc.invalidateQueries({ queryKey: financeKeys.cardStrategy() })
      qc.invalidateQueries({ queryKey: financeKeys.cardRecommendations() })
    },
  })
}

// ─── Perk Usage Detection ──────────────────────────────────────

export function useCheckPerkUsage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { cardProfileId: string }) =>
      financeFetch<{ matches: PerkUsageMatch[] }>("/cards/perk-usage", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
  })
}

// ─── Auto-Enrich Pipeline ──────────────────────────────────────

const ENRICH_TIMEOUT_MS = 130_000 // 130s client timeout (server CLI is 120s)

/** Fetch with a custom timeout (financeFetch default is 60s, too short for AI) */
async function financeFetchLong<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), ENRICH_TIMEOUT_MS)
  try {
    const res = await fetch(`/api/finance${path}`, {
      ...options,
      credentials: "include",
      headers: csrfHeaders({ "Content-Type": "application/json", ...options?.headers }),
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

/** Full pipeline for one card: ai-enrich → apply → perk-usage */
async function enrichOneCard(cardId: string): Promise<{ cardId: string; status: string; error?: string }> {
  try {
    // Use long timeout for AI enrichment (Claude CLI can take 60-120s)
    await financeFetchLong("/cards/ai-enrich", {
      method: "POST",
      body: JSON.stringify({ cardProfileId: cardId }),
    })
    await financeFetch("/cards/apply-enrichment", {
      method: "POST",
      body: JSON.stringify({ cardProfileId: cardId }),
    })
    await financeFetch("/cards/perk-usage", {
      method: "POST",
      body: JSON.stringify({ cardProfileId: cardId }),
    })
    return { cardId, status: "enriched" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[enrich] ${cardId} failed:`, msg)
    return { cardId, status: "failed", error: msg }
  }
}

/** Apply-only pipeline for cards that have AI data but missing DB rows */
async function applyOneCard(cardId: string): Promise<{ cardId: string; status: string }> {
  try {
    await financeFetch("/cards/apply-enrichment", {
      method: "POST",
      body: JSON.stringify({ cardProfileId: cardId }),
    })
    await financeFetch("/cards/perk-usage", {
      method: "POST",
      body: JSON.stringify({ cardProfileId: cardId }),
    })
    return { cardId, status: "applied" }
  } catch {
    return { cardId, status: "failed" }
  }
}

/**
 * Two-mode enrichment pipeline with progress tracking:
 * - `unenriched`: full pipeline (ai-enrich → apply → perk-usage) — parallel, 2 at a time
 * - `needsApply`: cards with AI data but no DB rows yet (apply → perk-usage only) — parallel
 */
export function useAutoEnrichCards() {
  const qc = useQueryClient()
  const [progress, setProgress] = useState<EnrichProgress | null>(null)

  const mutation = useMutation({
    mutationFn: async (input: {
      unenriched: string[]
      needsApply: string[]
      cardNames?: Record<string, string>
    }) => {
      const total = input.unenriched.length + input.needsApply.length
      const names = input.cardNames ?? {}
      let done = 0

      console.log(`[card-enrich] Starting enrichment for ${total} cards (${input.unenriched.length} full, ${input.needsApply.length} apply-only)`)
      setProgress({ current: 0, total, results: [] })

      // Process unenriched cards 2 at a time for faster enrichment
      const enrichResults: Array<{ cardId: string; cardName?: string; status: string; error?: string }> = []
      const batch = 2
      for (let i = 0; i < input.unenriched.length; i += batch) {
        const chunk = input.unenriched.slice(i, i + batch)

        // Show which cards are being enriched
        setProgress((prev) => ({
          current: done,
          total,
          currentCardName: chunk.map((id) => names[id] ?? "card").join(", "),
          results: prev?.results ?? [],
        }))

        const results = await Promise.allSettled(chunk.map(enrichOneCard))
        for (let j = 0; j < results.length; j++) {
          const r = results[j]
          const cardId = chunk[j]
          done++
          const entry = r.status === "fulfilled"
            ? { ...r.value, cardName: names[r.value.cardId] }
            : { cardId, cardName: names[cardId], status: "failed" }
          enrichResults.push(entry)
          setProgress({ current: done, total, results: [...enrichResults] })
        }
        // Invalidate after each batch so UI updates progressively
        qc.invalidateQueries({ queryKey: financeKeys.cards() })
      }

      // Apply-only cards can all run in parallel (no AI calls)
      if (input.needsApply.length > 0) {
        setProgress((prev) => ({
          current: done,
          total,
          currentCardName: "Applying saved data...",
          results: prev?.results ?? [],
        }))
      }
      const applyResults = await Promise.allSettled(input.needsApply.map(applyOneCard))
      const applyMapped = applyResults.map((r, idx) => {
        const cardId = input.needsApply[idx]
        return r.status === "fulfilled"
          ? { ...r.value, cardName: names[r.value.cardId] }
          : { cardId, cardName: names[cardId], status: "failed" }
      })

      const allResults = [...enrichResults, ...applyMapped]
      setProgress({ current: total, total, results: allResults })

      return allResults
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
    onSettled: () => {
      // Clear progress after a delay so user can see final state
      setTimeout(() => setProgress(null), 5_000)
    },
  })

  const reset = useCallback(() => setProgress(null), [])

  return { ...mutation, progress, resetProgress: reset }
}

// ─── Batch Perks Loader ────────────────────────────────────────

/**
 * Fetch perks for all cards in parallel.
 * Returns Record<cardId, CardPerk[]>.
 */
export function useAllCardPerks(cardIds: string[]) {
  return useQuery({
    queryKey: [...financeKeys.all, "all-card-perks", cardIds.join(",")] as const,
    queryFn: async () => {
      if (cardIds.length === 0) return {}
      const entries = await Promise.all(
        cardIds.map(async (id) => {
          try {
            const perks = await financeFetch<CardPerk[]>(`/cards/perks?cardId=${id}`)
            return [id, perks] as const
          } catch {
            return [id, []] as const
          }
        })
      )
      return Object.fromEntries(entries) as Record<string, CardPerk[]>
    },
    enabled: cardIds.length > 0,
  })
}
