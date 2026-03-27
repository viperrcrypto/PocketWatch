/**
 * React Query hooks for PocketWatch backup & restore.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { csrfHeaders } from "@/lib/csrf-client"

const backupKeys = {
  all: ["backup"] as const,
  schedule: () => [...backupKeys.all, "schedule"] as const,
}

// ─── Export ─────────────────────────────────────────────────────

export function useExportBackup() {
  return useMutation({
    mutationFn: async (password: string) => {
      const res = await fetch("/api/backup/export", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }))
        throw new Error(err.error ?? "Export failed")
      }

      // Trigger browser download
      const blob = await res.blob()
      const disposition = res.headers.get("Content-Disposition") ?? ""
      const match = disposition.match(/filename="(.+)"/)
      const filename = match?.[1] ?? "pocketwatch-backup.pwbackup"

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      return { filename }
    },
  })
}

// ─── Import ─────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean
  stats: {
    totalRecords: number
    tableCount: number
    tables: string[]
  }
  keysChanged: boolean
}

export function useImportBackup() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, password }: { file: File; password: string }) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("password", password)

      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: csrfHeaders(),
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Import failed" }))
        throw new Error(err.error ?? "Import failed")
      }

      return (await res.json()) as ImportResult
    },
    onSuccess: () => {
      // Invalidate everything — entire app state has changed
      qc.invalidateQueries()
    },
  })
}

// ─── Schedule ───────────────────────────────────────────────────

interface BackupSchedule {
  enabled: boolean
  frequency: "daily" | "weekly" | "monthly"
  retentionCount: number
  directory: string
  lastBackupAt: string | null
  lastBackupError: string | null
}

export function useBackupSchedule() {
  return useQuery({
    queryKey: backupKeys.schedule(),
    queryFn: async () => {
      const res = await fetch("/api/backup/schedule")
      if (!res.ok) throw new Error("Failed to load backup schedule")
      return (await res.json()) as BackupSchedule
    },
  })
}

export function useUpdateBackupSchedule() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      enabled?: boolean
      frequency?: string
      retentionCount?: number
      directory?: string
      password?: string
    }) => {
      const res = await fetch("/api/backup/schedule", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to update schedule" }))
        throw new Error(err.error ?? "Failed to update schedule")
      }

      return (await res.json()) as BackupSchedule
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: backupKeys.schedule() }),
  })
}
