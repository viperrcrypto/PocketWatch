"use client"

import { useState, useCallback, useRef } from "react"
import { toast } from "sonner"
import { useAccountCoverage, useUploadStatement } from "@/hooks/finance"
import { previewStatement, FORMAT_LABELS } from "@/lib/finance/statement-parser"
import type { BankFormat, ParsedRow, StatementUploadResult } from "@/lib/finance/statement-types"
import { cn } from "@/lib/utils"

interface PreviewState {
  format: BankFormat
  rows: ParsedRow[]
  totalLines: number
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export function StatementImportSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedAccountId, setSelectedAccountId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [isPDF, setIsPDF] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [result, setResult] = useState<StatementUploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadStatement()
  const { data } = useAccountCoverage()

  const accounts = data?.accounts ?? []
  const selectedAccount = accounts.find((a) => a.accountId === selectedAccountId)

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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const handleUpload = () => {
    if (!file || !selectedAccountId) return
    upload.mutate(
      { file, accountId: selectedAccountId },
      {
        onSuccess: (res) => {
          setResult(res)
          if (res.inserted > 0) toast.success(`Imported ${res.inserted} transactions`)
          else toast.info("No new transactions — all rows already exist")
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const handleReset = () => { setFile(null); setIsPDF(false); setPreview(null); setResult(null) }

  const coverage = selectedAccount
    ? { earliest: selectedAccount.earliestTransaction, latest: selectedAccount.latestTransaction, months: selectedAccount.monthsWithData.length, gaps: selectedAccount.monthsMissing.length, percent: selectedAccount.coveragePercent }
    : null

  return (
    <div className="bg-card border border-card-border rounded-2xl overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 20 }}>upload_file</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-foreground">Import Bank Statements</p>
            <p className="text-[11px] text-foreground-muted mt-0.5">
              Upload CSV or PDF statements to fill gaps in your transaction history
            </p>
          </div>
        </div>
        <span
          className={cn("material-symbols-rounded text-foreground-muted transition-transform duration-200", isOpen && "rotate-180")}
          style={{ fontSize: 18 }}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 border-t border-card-border/50 pt-4 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
              dragOver ? "border-primary bg-primary/5" : file ? "border-success/40 bg-success/5" : "border-card-border hover:border-foreground-muted/40"
            )}
          >
            <span className="material-symbols-rounded text-foreground-muted/40 mb-2 block" style={{ fontSize: 36 }}>
              {file ? "description" : "cloud_upload"}
            </span>
            {file ? (
              <div>
                <p className="text-sm font-medium text-foreground">{file.name}</p>
                <p className="text-[11px] text-foreground-muted mt-1">
                  {(file.size / 1024).toFixed(0)} KB — click or drop to replace
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-foreground">Click to upload or drag and drop</p>
                <p className="text-[11px] text-foreground-muted mt-1">
                  CSV or PDF files from Chase, Amex, Bank of America, Wells Fargo, Capital One, Discover, or any bank
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf"
              className="hidden"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
            />
          </div>

          {(preview || isPDF) && (
            <>
              {isPDF && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-rounded text-primary" style={{ fontSize: 14 }}>auto_awesome</span>
                  <span>PDF detected — will be parsed by <strong>AI</strong></span>
                </div>
              )}

              {preview && !isPDF && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="material-symbols-rounded text-success" style={{ fontSize: 14 }}>check_circle</span>
                  <span>Detected: <strong>{FORMAT_LABELS[preview.format]}</strong></span>
                  <span className="text-foreground-muted">{preview.totalLines} rows</span>
                </div>
              )}

              {preview && !isPDF && preview.rows.length > 0 && (
                <div className="border border-card-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-background-secondary/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-foreground-muted">Date</th>
                        <th className="text-left px-3 py-2 font-medium text-foreground-muted">Description</th>
                        <th className="text-right px-3 py-2 font-medium text-foreground-muted">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i} className="border-t border-card-border/50">
                          <td className="px-3 py-1.5 text-foreground-muted whitespace-nowrap font-data tabular-nums">{fmtDate(row.date)}</td>
                          <td className="px-3 py-1.5 truncate max-w-[250px] text-foreground">{row.name}</td>
                          <td className={cn("px-3 py-1.5 text-right whitespace-nowrap font-data tabular-nums", row.amount < 0 && "text-success")}>
                            {fmtCurrency(row.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.totalLines > 5 && (
                    <div className="px-3 py-1.5 text-[10px] text-foreground-muted bg-foreground/[0.02] text-center">
                      + {preview.totalLines - 5} more rows
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block mb-1.5 text-foreground-muted text-[11px] font-semibold">
                  Which account is this from?
                </label>
                <select
                  value={selectedAccountId}
                  onChange={(e) => { setSelectedAccountId(e.target.value); setResult(null) }}
                  className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2.5 px-3 text-foreground transition-colors appearance-none cursor-pointer text-sm"
                >
                  <option value="" className="bg-card text-foreground-muted">Choose an account...</option>
                  {accounts.map((acct) => (
                    <option key={acct.accountId} value={acct.accountId} className="bg-card text-foreground">
                      {acct.institutionName} — {acct.accountName}
                      {acct.mask ? ` (****${acct.mask})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {coverage && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-background-secondary/50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Data Coverage</span>
                      <span className="text-[10px] font-data font-bold tabular-nums text-foreground">{coverage.percent}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-background-secondary overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-500", coverage.percent >= 80 ? "bg-success" : coverage.percent >= 50 ? "bg-amber-500" : "bg-primary")}
                        style={{ width: `${Math.min(coverage.percent, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-foreground-muted">
                      {coverage.earliest && <span>From {coverage.earliest.slice(0, 7)}</span>}
                      {coverage.gaps > 0 && <span className="text-amber-500 font-medium">{coverage.gaps} month{coverage.gaps !== 1 ? "s" : ""} missing</span>}
                      {coverage.gaps === 0 && coverage.months > 0 && <span className="text-success font-medium">No gaps</span>}
                    </div>
                  </div>
                </div>
              )}

              {result && (
                <div className="bg-success/5 border border-success/20 rounded-xl p-4 space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium text-success">
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>check_circle</span>
                    Upload Complete
                  </div>
                  <div className="text-[11px] text-foreground-muted space-y-0.5 ml-6">
                    <p>{result.inserted} transactions imported</p>
                    {result.skipped > 0 && <p>{result.skipped} already existed (skipped)</p>}
                    {result.duplicates > 0 && <p>{result.duplicates} matched existing synced transactions</p>}
                    {result.errors.length > 0 && <p className="text-amber-500">{result.errors.length} rows could not be parsed</p>}
                  </div>
                </div>
              )}

              {selectedAccountId && !result && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={upload.isPending}
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
                        {isPDF ? "Upload & Parse with AI" : `Import ${preview?.totalLines ?? 0} transactions`}
                      </>
                    )}
                  </button>
                  <button onClick={handleReset} className="btn-ghost text-sm px-3 py-2">Clear</button>
                </div>
              )}

              {result && (
                <button onClick={handleReset} className="btn-secondary text-sm px-4 py-2">Upload another</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
