"use client"

import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import { useUploadStatement } from "@/hooks/finance"
import { previewStatement, FORMAT_LABELS } from "@/lib/finance/statement-parser"
import type { BankFormat, ParsedRow, StatementUploadResult } from "@/lib/finance/statement-types"

interface Props {
  accountId: string
  accountName: string
  onClose: () => void
}

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

export function StatementUploadModal({ accountId, accountName, onClose }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [isPDF, setIsPDF] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [result, setResult] = useState<StatementUploadResult | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const upload = useUploadStatement()

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
    if (!file) return
    upload.mutate(
      { file, accountId },
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-card-border rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
          <div>
            <h3 className="font-semibold text-sm">Upload Statement</h3>
            <p className="text-xs text-foreground-muted mt-0.5">{accountName}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1">
            <span className="material-symbols-rounded text-lg">close</span>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "border-card-border hover:border-foreground-muted"
            }`}
          >
            <span className="material-symbols-rounded text-3xl text-foreground-muted mb-2 block">upload_file</span>
            {file ? (
              <p className="text-sm">
                <span className="font-medium">{file.name}</span>
                <span className="text-foreground-muted ml-1">({(file.size / 1024).toFixed(0)} KB)</span>
              </p>
            ) : (
              <p className="text-sm text-foreground-muted">Drop CSV or PDF file here or click to browse</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
            />
          </div>

          {file && isPDF && (
            <div className="flex items-center gap-2 text-xs">
              <span className="material-symbols-rounded text-primary text-sm">auto_awesome</span>
              <span>PDF detected — will be parsed by <strong>AI</strong></span>
            </div>
          )}

          {preview && !isPDF && (
            <div className="flex items-center gap-2 text-xs">
              <span className="material-symbols-rounded text-success text-sm">check_circle</span>
              <span>Detected: <strong>{FORMAT_LABELS[preview.format]}</strong></span>
              <span className="text-foreground-muted">&middot; {preview.totalLines} rows</span>
            </div>
          )}

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
                      <td className="px-3 py-1.5 truncate max-w-[200px]">{row.name}</td>
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

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="btn-ghost text-sm px-4 py-2">
              {result ? "Done" : "Cancel"}
            </button>
            {!result && (
              <button
                onClick={handleUpload}
                disabled={!file || (!preview && !isPDF) || upload.isPending}
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
                    Upload
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
