"use client"

import { useState } from "react"
import { useExportTaxReport } from "@/hooks/use-portfolio-tracker"

export function PnlExportDropdown({ taxYear, wallets, assets }: { taxYear: string; wallets?: string[]; assets?: string[] }) {
  const [open, setOpen] = useState(false)
  const exportMutation = useExportTaxReport()

  const items = [
    { format: "form8949", label: "Form 8949 (IRS)", icon: "description" },
    { format: "schedule_d", label: "Schedule D Summary", icon: "summarize" },
    { format: "turbotax", label: "TurboTax CSV", icon: "upload_file" },
    { format: "csv", label: "Full CSV", icon: "table_chart" },
  ]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors rounded-xl text-xs font-medium tracking-wide"
      >
        <span className="material-symbols-rounded text-sm">download</span>
        Export
        <span className="material-symbols-rounded text-sm">expand_more</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-card-border rounded-xl shadow-lg py-1 min-w-[200px]">
            {items.map((item) => (
              <button
                key={item.format}
                onClick={() => {
                  setOpen(false)
                  exportMutation.mutate({ format: item.format, taxYear, wallets, assets })
                }}
                disabled={exportMutation.isPending}
                className="w-full px-4 py-2.5 text-left flex items-center gap-3 hover:bg-background-secondary transition-colors text-sm text-foreground"
              >
                <span className="material-symbols-rounded text-base text-foreground-muted">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
