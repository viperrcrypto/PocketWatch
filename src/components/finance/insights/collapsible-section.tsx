"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/utils"

export function CollapsibleSection({ title, children, defaultOpen = true }: {
  title: string; children: ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left group mb-3"
      >
        <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">
          {title}
        </span>
        <span className={cn(
          "material-symbols-rounded text-foreground-muted text-sm transition-transform duration-200",
          open && "rotate-180"
        )}>
          expand_more
        </span>
      </button>
      <div className={cn(
        "overflow-hidden transition-all duration-200",
        open ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
      )}>
        {children}
      </div>
    </div>
  )
}
