"use client"

import { cn } from "@/lib/utils"
import type { PreviewState } from "./upload-drop-zone"
import type { AccountCoverage, StatementUploadResult } from "@/lib/finance/statement-types"

interface Props {
  isPDF: boolean
  preview: PreviewState | null
  accountName: string
  onUpload: () => void
  onReset: () => void
  result: StatementUploadResult | null
  isUploading: boolean
  coverage: {
    earliest: string | null
    latest: string | null
    months: number
    gaps: number
    percent: number
  } | null
}

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount)
}

function fmtDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
}

export function UploadConfirmStep({ isPDF, preview, accountName, onUpload, onReset, result, isUploading, coverage }: Props) {
  // CSV preview table
  const previewTable = preview && !isPDF && preview.rows.length > 0 && (
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
  )

  // Coverage bar
  const coverageBar = coverage && coverage.months > 0 && (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-background-secondary/50">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Data Coverage</span>
          <span className="text-[10px] font-data font-bold tabular-nums text-foreground">{coverage.percent}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-background-secondary overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-[width] duration-500",
              coverage.percent >= 80 ? "bg-success" : coverage.percent >= 50 ? "bg-amber-500" : "bg-primary"
            )}
            style={{ width: `${Math.min(coverage.percent, 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-foreground-muted">
          {coverage.earliest && <span>From {coverage.earliest.slice(0, 7)}</span>}
          {coverage.gaps > 0 && <span className="text-amber-500 font-medium">{coverage.gaps} month{coverage.gaps !== 1 ? "s" : ""} missing</span>}
          {coverage.gaps === 0 && <span className="text-success font-medium">No gaps</span>}
        </div>
      </div>
    </div>
  )

  // Result card
  if (result) {
    const hasErrors = result.errors.length > 0
    const nothingImported = result.inserted === 0
    const allSkipped = nothingImported && result.skipped > 0 && !hasErrors
    const borderColor = hasErrors ? "border-amber-500/20" : "border-success/20"
    const bgColor = hasErrors ? "bg-amber-500/5" : "bg-success/5"
    const iconColor = allSkipped ? "text-foreground-muted" : hasErrors ? "text-amber-500" : "text-success"
    const icon = hasErrors ? "warning" : allSkipped ? "info" : "check_circle"
    const title = hasErrors && nothingImported
      ? "Upload completed with errors"
      : allSkipped
        ? "No new transactions"
        : "Upload Complete"

    return (
      <div className="space-y-3">
        <div className={cn("border rounded-xl p-4 space-y-2", bgColor, borderColor)}>
          <div className={cn("flex items-center gap-2 text-sm font-medium", iconColor)}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{icon}</span>
            {title}
          </div>
          <div className="text-[11px] text-foreground-muted space-y-0.5 ml-6">
            {result.inserted > 0 && <p>{result.inserted} transactions imported</p>}
            {result.skipped > 0 && <p>{result.skipped} already existed (skipped)</p>}
            {result.duplicates > 0 && <p>{result.duplicates} matched existing synced transactions (flagged)</p>}
            {hasErrors && (
              <div className="mt-1.5 space-y-0.5">
                <p className="text-amber-500 font-medium">{result.errors.length} row{result.errors.length !== 1 ? "s" : ""} could not be parsed:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-amber-500/80 pl-2">&bull; {err}</p>
                ))}
              </div>
            )}
          </div>
        </div>
        <button onClick={onReset} className="btn-secondary text-sm px-4 py-2">Upload another</button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {previewTable}
      {coverageBar}
      <div className="flex items-center gap-3">
        <button
          onClick={onUpload}
          disabled={isUploading}
          className="btn-primary text-sm px-4 py-2 flex items-center gap-1.5 disabled:opacity-50"
        >
          {isUploading ? (
            <>
              <span className="material-symbols-rounded animate-spin text-sm">progress_activity</span>
              {isPDF ? "AI parsing..." : "Uploading..."}
            </>
          ) : (
            <>
              <span className="material-symbols-rounded text-sm">upload</span>
              {isPDF
                ? `Upload & Parse with AI`
                : `Import ${preview?.totalLines ?? 0} transactions to ${accountName}`}
            </>
          )}
        </button>
        <button onClick={onReset} className="btn-ghost text-sm px-3 py-2">Clear</button>
      </div>
    </div>
  )
}
