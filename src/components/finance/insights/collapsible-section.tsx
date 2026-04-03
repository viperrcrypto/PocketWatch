"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function CollapsibleSection({ title, children, defaultOpen = true, count }: {
  title: string; children: ReactNode; defaultOpen?: boolean; count?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn(!open && "border-b border-card-border/30 pb-1")}>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2.5 w-full text-left group mb-3">
        <div className="w-0.5 h-3.5 rounded-full bg-primary" />
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">{title}</span>
        {count !== undefined && (
          <span className="text-[9px] font-medium tabular-nums px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{count}</span>
        )}
        <div className="flex-1" />
        <div className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-colors",
          "bg-background-secondary group-hover:bg-foreground/[0.06]"
        )}>
          <span className={cn(
            "material-symbols-rounded text-foreground-muted text-sm transition-transform duration-200",
            open && "rotate-180"
          )}>expand_more</span>
        </div>
      </button>
      <div className={cn(
        "overflow-hidden transition-colors duration-200",
        open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
      )}>
        {children}
      </div>
    </div>
  )
}
