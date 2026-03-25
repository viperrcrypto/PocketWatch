/**
 * Hook for AI Rebuild categorization with SSE streaming.
 * Manages connection lifecycle, progress state, and cancellation.
 */

import { useState, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
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
  durationMs: number
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

// ─── Hook ───────────────────────────────────────────────────────

export function useAIRebuild() {
  const [state, setState] = useState<AIRebuildState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)
  const qc = useQueryClient()

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
        headers: { "Content-Type": "application/json" },
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
            case "complete":
              setState((prev) => ({
                ...prev,
                status: "complete",
                summary: data.summary as RebuildSummary,
              }))
              qc.invalidateQueries({ queryKey: financeKeys.all })
              break
            case "error":
              if (data.batchIndex !== undefined) {
                // Batch-level error, continue
                break
              }
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
    await fetch("/api/finance/transactions/ai-rebuild", { method: "DELETE", credentials: "include" }).catch(() => {})
    setState((prev) => ({ ...prev, status: prev.status === "running" ? "paused" : prev.status }))
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(INITIAL_STATE)
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
