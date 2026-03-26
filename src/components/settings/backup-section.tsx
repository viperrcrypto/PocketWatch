"use client"

import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useExportBackup, useImportBackup, type ImportResult } from "@/hooks/use-backup"
import { BackupScheduleCard } from "./backup-schedule-card"

// ─── Export Card ──────────────────────────────────────────────────

function ExportCard() {
  const [password, setPassword] = useState("")
  const exportBackup = useExportBackup()

  const handleExport = () => {
    if (!password) { toast.error("Enter your vault password"); return }
    exportBackup.mutate(password, {
      onSuccess: ({ filename }) => {
        toast.success(`Backup created: ${filename}`)
        setPassword("")
      },
      onError: (err) => toast.error(err.message),
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Create Backup</p>
        <p className="text-xs text-foreground-muted mt-0.5">
          Download an encrypted backup of all your data. The file is protected with your vault password.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleExport()}
          placeholder="Vault password"
          className="flex-1 px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
        />
        <button
          onClick={handleExport}
          disabled={exportBackup.isPending || !password}
          className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {exportBackup.isPending ? (
            <>
              <span className="material-symbols-rounded animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
              Exporting...
            </>
          ) : (
            <>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>download</span>
              Export
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Import Card ──────────────────────────────────────────────────

function ImportCard() {
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const importBackup = useImportBackup()

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".pwbackup")) {
      toast.error("Please select a .pwbackup file")
      return
    }
    setFile(f)
    setResult(null)
  }, [])

  const handleImport = () => {
    if (!file || !password) return
    importBackup.mutate({ file, password }, {
      onSuccess: (res) => {
        setResult(res)
        toast.success(`Restored ${res.stats.totalRecords.toLocaleString()} records across ${res.stats.tableCount} tables`)
        setFile(null)
        setPassword("")
      },
      onError: (err) => toast.error(err.message),
    })
  }

  const handleReset = () => { setFile(null); setPassword(""); setResult(null) }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-foreground">Restore from Backup</p>
        <p className="text-xs text-foreground-muted mt-0.5">
          Upload a .pwbackup file to restore all data. This will replace all existing data.
        </p>
      </div>

      {result ? (
        <div className="space-y-3">
          <div className="bg-success/5 border border-success/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-rounded text-success" style={{ fontSize: 18 }}>check_circle</span>
              <span className="text-sm font-semibold text-foreground">Restore Complete</span>
            </div>
            <p className="text-xs text-foreground-muted">
              {result.stats.totalRecords.toLocaleString()} records across {result.stats.tableCount} tables
            </p>
          </div>
          {result.keysChanged && (
            <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded text-warning" style={{ fontSize: 18 }}>warning</span>
                <span className="text-sm font-semibold">Update your .env file</span>
              </div>
              <p className="text-xs text-foreground-muted">
                This backup was created with different encryption keys. Copy the ENCRYPTION_KEY
                and FINANCE_ENCRYPTION_KEY from your original deployment&apos;s .env file to this
                server&apos;s .env and restart the app. Without the correct keys, encrypted data
                will not be accessible after restart.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Dropzone */}
          <input
            ref={inputRef}
            type="file"
            accept=".pwbackup"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          {!file ? (
            <div
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f) handleFile(f)
              }}
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-card-border hover:border-card-border-hover",
              )}
            >
              <span className="material-symbols-rounded text-foreground-muted mb-1 block" style={{ fontSize: 28 }}>upload_file</span>
              <p className="text-xs text-foreground-muted">
                Drop a .pwbackup file or <span className="text-primary font-medium">browse</span>
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-background rounded-lg px-3 py-2">
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>description</span>
                <span className="text-sm text-foreground truncate flex-1">{file.name}</span>
                <span className="text-xs text-foreground-muted">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                <button onClick={handleReset} className="text-foreground-muted hover:text-foreground">
                  <span className="material-symbols-rounded" style={{ fontSize: 16 }}>close</span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleImport()}
                  placeholder="Vault password"
                  className="flex-1 px-3 py-2 text-sm bg-background border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none"
                />
                <button
                  onClick={handleImport}
                  disabled={importBackup.isPending || !password}
                  className="px-4 py-2 text-sm font-medium bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {importBackup.isPending ? (
                    <>
                      <span className="material-symbols-rounded animate-spin" style={{ fontSize: 16 }}>progress_activity</span>
                      Restoring...
                    </>
                  ) : (
                    "Restore"
                  )}
                </button>
              </div>
              <p className="text-[10px] text-warning">
                This will wipe all existing data and replace it with the backup.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Main Section ─────────────────────────────────────────────────

export function BackupSection() {
  return (
    <div className="p-5 space-y-6">
      <ExportCard />
      <div className="border-t border-card-border" />
      <ImportCard />
      <div className="border-t border-card-border" />
      <BackupScheduleCard />
    </div>
  )
}
