"use client"

import { useState, type ReactNode } from "react"

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = false,
  actions,
  children,
  id,
}: {
  title: string
  subtitle: string
  defaultOpen?: boolean
  actions?: ReactNode
  children: ReactNode
  id?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div id={id} className="bg-card border border-card-border rounded-xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full px-5 py-4 ${open ? "border-b border-card-border" : ""} flex flex-wrap items-center justify-between gap-3 text-left cursor-pointer hover:bg-background/30 transition-colors rounded-t-xl`}
      >
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-rounded text-sm text-foreground-muted transition-transform duration-200"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            chevron_right
          </span>
          <div>
            <h2 className="text-foreground text-sm font-semibold">{title}</h2>
            <p className="mt-1 text-foreground-muted text-xs">{subtitle}</p>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>{actions}</div>}
      </button>
      {open && children}
    </div>
  )
}
