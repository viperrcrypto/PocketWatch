"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { useAccountCoverage, useUploadStatement } from "@/hooks/finance"
import { previewStatement, FORMAT_LABELS } from "@/lib/finance/statement-parser"
import { InlineAccountForm } from "./inline-account-form"
import type { BankFormat, ParsedRow, StatementUploadResult } from "@/lib/finance/statement-types"

interface PreviewState {
  format: BankFormat
  rows: ParsedRow[]
  totalLines: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export function StatementUploadInline() {
  const { data } = useAccountCoverage()
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [file, setFile] = useState<File | null>(null)
  const [isPDF, setIsPDF] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [result, setResult] = useState<StatementUploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showNewAccount, setShowNewAccount] = useState(false)
  const [pendingAccountName, setPendingAccountName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadStatement()

  const accounts = data?.accounts ?? []

  const processFile = useCallback((f: File) => {
    const name = f.name.toLowerCase()
    const pdf = name.endsWith(".pdf")
    const csv = name.endsWith(".csv")
    if (!pdf && !csv) {
      toast.error("Please select a CSV or PDF file")
      return
    }
    setFile(f)
    setIsPDF(pdf)
    setResult(null)
    setPreview(null)
    if (csv) {
      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const p = previewStatement(text, 5)
        setPreview({ format: p.format, rows: p.rows, totalLines: p.totalLines })
      }
      reader.readAsText(f)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const f = e.dataTransfer.files[0]
      if (f) processFile(f)
    },
    [processFile]
  )

  const handleUpload = () => {
    if (!file || !selectedAccountId) return
    upload.mutate(
      { file, accountId: selectedAccountId },
      {
        onSuccess: (res) => {
          setResult(res)
          if (res.inserted > 0) toast.success(`Imported ${res.inserted} transactions`)
          else toast.info("No new transactions to import — all rows already exist")
        },
        onError: (err) => toast.error(err.message),
      }
    )
  }

  const handleReset = () => {
    setFile(null)
    setIsPDF(false)
    setPreview(null)
    setResult(null)
    setPendingAccountName(null)
  }

  const selectedAccount = accounts.find((a) => a.accountId === selectedAccountId)
  const isNewAccountPending = selectedAccountId && !selectedAccount && pendingAccountName
  const canUpload = file && selectedAccountId && (preview || isPDF) && !result

  return (
    <div className="space-y-4">
      {/* Account selector + Add Account button */}
      <div>
        <label className="block mb-2 text-foreground-muted text-xs font-semibold">Account</label>
        <div className="flex items-center gap-2 max-w-lg">
          <select
            value={selectedAccountId}
            onChange={(e) => { setSelectedAccountId(e.target.value); setResult(null) }}
            className="flex-1 bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2.5 px-3 text-foreground transition-colors appearance-none cursor-pointer text-sm"
          >
            <option value="" className="bg-card text-foreground-muted">Select an account...</option>
            {accounts.map((acct) => (
              <option key={acct.accountId} value={acct.accountId} className="bg-card text-foreground">
                {acct.institutionName} — {acct.accountName}
                {acct.mask ? ` (****${acct.mask})` : ""}
              </option>
            ))}
            {isNewAccountPending && (
              <option value={selectedAccountId} className="bg-card text-foreground">
                Manual — {pendingAccountName}
              </option>
            )}
          </select>
          <button
            onClick={() => setShowNewAccount(!showNewAccount)}
            className="flex items-center gap-1 px-3 py-2.5 rounded-lg border border-dashed border-primary/40 text-primary text-sm font-medium hover:bg-primary/5 transition-colors whitespace-nowrap"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add</span>
            Add Account
          </button>
        </div>
      </div>

      {/* Inline new account form */}
      {showNewAccount && (
        <InlineAccountForm
          onCreated={(acct) => {
            setSelectedAccountId(acct.id)
            setPendingAccountName(acct.name)
            setShowNewAccount(false)
          }}
          onCancel={() => setShowNewAccount(false)}
        />
      )}

      {/* Drop zone — ALWAYS visible */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : file
              ? "border-success/40 bg-success/5"
              : "border-card-border hover:border-foreground-muted"
        }`}
      >
        <span className="material-symbols-rounded text-3xl text-foreground-muted mb-2 block">
          {file ? "description" : "upload_file"}
        </span>
        {file ? (
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-foreground-muted mt-0.5">
              {(file.size / 1024).toFixed(0)} KB &middot; Click or drop to replace
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium text-foreground-muted">
              Drop a CSV or PDF statement here
            </p>
            <p className="text-xs text-foreground-muted mt-0.5">
              or click to browse &middot; CSV parsed locally, PDF parsed by AI
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.pdf"
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) processFile(f)
          }}
        />
      </div>

      {/* PDF indicator */}
      {file && isPDF && (
        <div className="flex items-center gap-2 text-xs">
          <span className="material-symbols-rounded text-primary text-sm">auto_awesome</span>
          <span>PDF detected — will be parsed by <strong>AI</strong></span>
          <span className="text-foreground-muted">&middot; {(file.size / 1024).toFixed(0)} KB</span>
        </div>
      )}

      {/* CSV format detection */}
      {preview && !isPDF && (
        <div className="flex items-center gap-2 text-xs">
          <span className="material-symbols-rounded text-success text-sm">check_circle</span>
          <span>Detected: <strong>{FORMAT_LABELS[preview.format]}</strong></span>
          <span className="text-foreground-muted">&middot; {preview.totalLines} rows</span>
        </div>
      )}

      {/* Preview table (CSV only) */}
      {preview && preview.rows.length > 0 && !isPDF && (
        <div className="border border-card-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-card-border/20">
              <tr>
                <th className="text-left px-3 py-2 font-medium">Date</th>
                <th className="text-left px-3 py-2 font-medium">Description</th>
                <th className="text-right px-3 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, i) => (
                <tr key={i} className="border-t border-card-border/50">
                  <td className="px-3 py-1.5 text-foreground-muted whitespace-nowrap">{formatDate(row.date)}</td>
                  <td className="px-3 py-1.5 truncate max-w-[300px]">{row.name}</td>
                  <td className={`px-3 py-1.5 text-right whitespace-nowrap ${row.amount < 0 ? "text-success" : ""}`}>
                    {formatCurrency(row.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {preview.totalLines > 5 && (
            <div className="px-3 py-1.5 text-xs text-foreground-muted bg-card-border/10 text-center">
              + {preview.totalLines - 5} more rows
            </div>
          )}
        </div>
      )}

      {/* Upload result */}
      {result && (
        <div className="bg-success/5 border border-success/20 rounded-lg p-4 space-y-1">
          <div className="flex items-center gap-2 text-sm font-medium text-success">
            <span className="material-symbols-rounded text-lg">check_circle</span>
            Upload Complete
          </div>
          <div className="text-xs text-foreground-muted space-y-0.5 ml-7">
            <p>{result.inserted} transactions imported</p>
            {result.skipped > 0 && <p>{result.skipped} already existed (skipped)</p>}
            {result.duplicates > 0 && <p>{result.duplicates} matched existing synced transactions</p>}
            {result.errors.length > 0 && <p className="text-warning">{result.errors.length} rows could not be parsed</p>}
          </div>
        </div>
      )}

      {/* Upload button / hint */}
      {file && (preview || isPDF) && !result && (
        <div className="flex items-center gap-3">
          {!selectedAccountId ? (
            <p className="text-xs text-foreground-muted">Select an account above to upload</p>
          ) : (
            <>
              <button
                onClick={handleUpload}
                disabled={!canUpload || upload.isPending}
                className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
              >
                {upload.isPending ? (
                  <>
                    <span className="material-symbols-rounded animate-spin text-sm">progress_activity</span>
                    {isPDF ? "AI parsing..." : "Uploading..."}
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded text-sm">upload</span>
                    Upload to {selectedAccount?.accountName ?? pendingAccountName ?? "account"}
                  </>
                )}
              </button>
              <button onClick={handleReset} className="btn-ghost text-sm px-3 py-2">Clear</button>
            </>
          )}
        </div>
      )}

      {result && (
        <button onClick={handleReset} className="btn-secondary text-sm px-4 py-2">Upload another</button>
      )}
    </div>
  )
}
