"use client"

import { useState } from "react"
import { toast } from "sonner"
import { cn, formatRelativeTime } from "@/lib/utils"
import { useBackupSchedule, useUpdateBackupSchedule } from "@/hooks/use-backup"

export function BackupScheduleCard() {
  const { data: schedule } = useBackupSchedule()
  const updateSchedule = useUpdateBackupSchedule()
  const [password, setPassword] = useState("")
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [isBrowsing, setIsBrowsing] = useState(false)

  const handleToggle = () => {
    if (!schedule?.enabled && !showPasswordInput) {
      setShowPasswordInput(true)
      return
    }
    if (schedule?.enabled) {
      updateSchedule.mutate({ enabled: false }, {
        onSuccess: () => toast.success("Auto-backup disabled"),
        onError: (err) => toast.error(err.message),
      })
      return
    }
    if (!password) { toast.error("Password required"); return }
    updateSchedule.mutate({ enabled: true, password }, {
      onSuccess: () => { toast.success("Auto-backup enabled"); setShowPasswordInput(false); setPassword("") },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleBrowse = async () => {
    if (isBrowsing) return
    setIsBrowsing(true)
    try {
      // Open native OS folder picker via File System Access API
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" })

      // Write a temporary marker file so the server can find the absolute path
      const marker = crypto.randomUUID()
      const markerFile = await handle.getFileHandle(`.pwmarker-${marker}`, { create: true })
      const writable = await markerFile.createWritable()
      await writable.write("marker")
      await writable.close()

      // Ask server to find the marker and resolve the path
      const res = await fetch("/api/backup/browse-dirs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve", marker }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.message ?? "Could not resolve folder path")
        return
      }

      const data = await res.json()
      updateSchedule.mutate({ directory: data.path }, {
        onSuccess: () => toast.success(`Backup directory set to ${data.path}`),
        onError: (err) => toast.error(err.message),
      })
    } catch (err: unknown) {
      // User cancelled the picker — AbortError is expected
      if (err instanceof DOMException && err.name === "AbortError") return
      toast.error("Failed to select folder")
    } finally {
      setIsBrowsing(false)
    }
  }

  if (!schedule) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Automatic Backups</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            {schedule.enabled
              ? `Running ${schedule.frequency} — keeping ${schedule.retentionCount} backups`
              : "Schedule automatic encrypted backups"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={updateSchedule.isPending}
          className={cn(
            "w-10 h-5 rounded-full transition-colors relative",
            schedule.enabled ? "bg-primary" : "bg-foreground/20",
          )}
        >
          <div className={cn(
            "w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform shadow-sm",
            schedule.enabled ? "translate-x-5" : "translate-x-0.5",
          )} />
        </button>
      </div>

      {showPasswordInput && !schedule.enabled && (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleToggle()}
            placeholder="Vault password to enable"
            className="flex-1 px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
          />
          <button onClick={handleToggle} disabled={!password} className="px-3 py-2 text-xs font-medium bg-primary text-white rounded-lg disabled:opacity-50">
            Enable
          </button>
          <button onClick={() => setShowPasswordInput(false)} className="px-3 py-2 text-xs text-foreground-muted hover:text-foreground">
            Cancel
          </button>
        </div>
      )}

      {schedule.enabled && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <select
              value={schedule.frequency}
              onChange={(e) => updateSchedule.mutate({ frequency: e.target.value })}
              className="px-2 py-1 text-xs bg-background border border-card-border rounded-lg"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            <span className="text-xs text-foreground-muted">
              Keep <select
                value={schedule.retentionCount}
                onChange={(e) => updateSchedule.mutate({ retentionCount: Number(e.target.value) })}
                className="px-1 py-0.5 bg-background border border-card-border rounded text-xs mx-1"
              >
                {[3, 5, 7, 14, 30].map((n) => <option key={n} value={n}>{n}</option>)}
              </select> backups
            </span>
          </div>

          {/* Directory */}
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 16 }}>folder</span>
            <span className="text-xs text-foreground-muted font-mono truncate flex-1" title={schedule.directory}>
              {schedule.directory}
            </span>
            <button
              onClick={handleBrowse}
              disabled={isBrowsing}
              className="px-2 py-1 text-[11px] border border-card-border rounded-lg text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors flex-shrink-0 disabled:opacity-50"
            >
              {isBrowsing ? "Opening..." : "Browse"}
            </button>
          </div>

          {/* Status */}
          {schedule.lastBackupAt && !schedule.lastBackupError && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-rounded text-success" style={{ fontSize: 14 }}>check_circle</span>
              <span className="text-[11px] text-foreground-muted">
                Last backup {formatRelativeTime(schedule.lastBackupAt)}
              </span>
            </div>
          )}
          {schedule.lastBackupError && (
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-rounded text-error" style={{ fontSize: 14 }}>error</span>
              <span className="text-[11px] text-error" title={schedule.lastBackupError}>
                Last backup failed — {schedule.lastBackupError.length > 60 ? schedule.lastBackupError.slice(0, 60) + "..." : schedule.lastBackupError}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
