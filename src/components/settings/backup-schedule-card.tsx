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
          {schedule.lastBackupAt && (
            <span className="text-[10px] text-foreground-muted">
              Last: {formatRelativeTime(schedule.lastBackupAt)}
            </span>
          )}
          {schedule.lastBackupError && (
            <span className="text-[10px] text-error" title={schedule.lastBackupError}>
              Last backup failed
            </span>
          )}
        </div>
      )}
    </div>
  )
}
