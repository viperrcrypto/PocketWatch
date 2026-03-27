/**
 * Hook for AI Rebuild categorization with SSE streaming.
 * Persists state to localStorage so the user can navigate away during a rebuild
 * and return to see results. The server continues processing even after disconnect.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"
import { financeKeys } from "./shared"

// ─── Types ──────────────────────────────────────────────────────

type RebuildStatus = "idle" | "counting" | "running" | "paused" | "complete" | "error"

interface RebuildPreview {
  merchantCount: number
  txCount: number
  batchCount: number
}

interface BatchProgress {
  batchIndex: number
  totalBatches: number
  merchantsProcessed: number
  totalMerchants: number
  message: string
}

export interface ProcessedMerchant {
  merchantName: string
  category: string
  subcategory: string | null
  txCount: number
}

export interface RebuildSummary {
  totalMerchants: number
  totalTxCategorized: number
  rulesCreated: number
  rulesUpdated: number
  customCategoriesCreated: number
  batchesCompleted: number
  batchesFailed: number
  failedMerchants?: string[]
  durationMs: number
  qualityCheck?: {
    totalTransactions: number
    categorized: number
    uncategorized: number
    categorizedPct: number
    incomeCount: number
    incomeTotal: number
    transferCount: number
    topCategories: Array<{ category: string; count: number; total: number }>
    duplicateRules: number
    orphanedRules: number
    issues: string[]
    grade: "A" | "B" | "C" | "D" | "F"
  }
}

interface AIRebuildState {
  status: RebuildStatus
  preview: RebuildPreview | null
  progress: BatchProgress | null
  processedMerchants: ProcessedMerchant[]
  summary: RebuildSummary | null
  error: string | null
}

const INITIAL_STATE: AIRebuildState = {
  status: "idle",
  preview: null,
  progress: null,
  processedMerchants: [],
  summary: null,
  error: null,
}

const STORAGE_KEY = "pw-ai-rebuild-state"

// ─── Persistence Helpers ────────────────────────────────────────

function saveToStorage(state: AIRebuildState): void {
  try {
    // Only persist meaningful states (not idle/counting)
    if (state.status === "running" || state.status === "complete" || state.status === "paused") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...state,
        savedAt: Date.now(),
      }))
    }
  } catch { /* localStorage unavailable */ }
}

function loadFromStorage(): AIRebuildState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const saved = JSON.parse(raw)
    // Expire after 30 minutes
    if (Date.now() - (saved.savedAt ?? 0) > 30 * 60 * 1000) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return {
      status: saved.status,
      preview: saved.preview,
      progress: saved.progress,
      processedMerchants: saved.processedMerchants ?? [],
      summary: saved.summary,
      error: saved.error,
    }
  } catch { return null }
}

function clearStorage(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ok */ }
}

// ─── Hook ───────────────────────────────────────────────────────

export function useAIRebuild() {
  const [state, setState] = useState<AIRebuildState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const qc = useQueryClient()
  const checkedServerRef = useRef(false)

  // On mount: check server for completed rebuild, or restore from localStorage
  useEffect(() => {
    if (checkedServerRef.current) return
    checkedServerRef.current = true

    const recover = async () => {
      try {
        const res = await fetch("/api/finance/transactions/ai-rebuild", {
          credentials: "include",
        })
        if (!res.ok) return

        const data = await res.json()
        if (data.summary) {
          // Server has a completed rebuild — show it
          const stored = loadFromStorage()
          setState({
            status: "complete",
            preview: null,
            progress: null,
            processedMerchants: stored?.processedMerchants ?? [],
            summary: data.summary,
            error: null,
          })
          return
        }
      } catch { /* server check failed, try localStorage */ }

      // Fall back to localStorage (partial progress from before navigation)
      const stored = loadFromStorage()
      if (stored && stored.status !== "idle") {
        // If was "running" when we left, server may have completed — show as partial
        setState({
          ...stored,
          status: stored.status === "running" ? "paused" : stored.status,
        })
      }
    }

    recover()
  }, [])

  // Persist state to localStorage on every meaningful update
  useEffect(() => {
    saveToStorage(state)
  }, [state])

  const start = useCallback(async (mode: "uncategorized" | "full", dryRun = false) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState((prev) => ({
      ...prev,
      status: dryRun ? "counting" : "running",
      error: null,
      ...(dryRun ? {} : { processedMerchants: [], summary: null }),
    }))

    try {
      const res = await fetch("/api/finance/transactions/ai-rebuild", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...csrfHeaders() },
        credentials: "include",
        body: JSON.stringify({ mode, dryRun }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}))
        setState((prev) => ({ ...prev, status: "error", error: err.error ?? "Failed to start rebuild" }))
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() ?? ""

        for (const chunk of lines) {
          const eventMatch = chunk.match(/^event:\s*(.+)$/m)
          const dataMatch = chunk.match(/^data:\s*(.+)$/m)
          if (!eventMatch || !dataMatch) continue

          const event = eventMatch[1]
          const data = JSON.parse(dataMatch[1])

          switch (event) {
            case "preview":
              setState((prev) => ({
                ...prev,
                preview: data as RebuildPreview,
                status: dryRun ? "idle" : prev.status,
              }))
              break
            case "progress":
              setState((prev) => ({ ...prev, progress: data as BatchProgress }))
              break
            case "batch_complete":
              setState((prev) => ({
                ...prev,
                processedMerchants: [...prev.processedMerchants, ...(data.results as ProcessedMerchant[])],
              }))
              break
            case "quality_check":
              // Quality check data arrives before complete — merge into summary
              setState((prev) => ({
                ...prev,
                summary: prev.summary ? { ...prev.summary, qualityCheck: data.qualityCheck } : prev.summary,
              }))
              break
            case "complete":
              setState((prev) => ({
                ...prev,
                status: "complete",
                summary: data.summary as RebuildSummary,
              }))
              qc.invalidateQueries({ queryKey: financeKeys.all })
              break
            case "error":
              if (data.batchIndex !== undefined) break // batch-level, continue
              setState((prev) => ({ ...prev, status: "error", error: data.message }))
              break
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setState((prev) => ({ ...prev, status: "paused" }))
      } else {
        setState((prev) => ({ ...prev, status: "error", error: err instanceof Error ? err.message : "Connection failed" }))
      }
    }
  }, [qc])

  const cancel = useCallback(async () => {
    abortRef.current?.abort()
    await fetch("/api/finance/transactions/ai-rebuild", { method: "DELETE", credentials: "include", headers: csrfHeaders() }).catch(() => {})
    setState((prev) => ({ ...prev, status: prev.status === "running" ? "paused" : prev.status }))
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL_STATE)
    clearStorage()
  }, [])

  return {
    state,
    start,
    cancel,
    reset,
    isRunning: state.status === "running",
    isCounting: state.status === "counting",
    isComplete: state.status === "complete",
  }
}
