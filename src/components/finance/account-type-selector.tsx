"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking", icon: "account_balance", color: "badge-neutral" },
  { value: "savings", label: "Savings", icon: "savings", color: "badge-success" },
  { value: "credit", label: "Credit", icon: "credit_card", color: "badge-warning" },
  { value: "business_credit", label: "Business CC", icon: "credit_card", color: "badge-warning" },
  { value: "investment", label: "Investment", icon: "trending_up", color: "badge-neutral" },
  { value: "loan", label: "Loan", icon: "account_balance", color: "badge-error" },
  { value: "mortgage", label: "Mortgage", icon: "home", color: "badge-error" },
] as const

interface AccountTypeSelectorProps {
  type: string
  onChangeType: (type: string) => void
  className?: string
}

export function AccountTypeSelector({ type, onChangeType, className }: AccountTypeSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  const current = ACCOUNT_TYPES.find((t) => t.value === type) ?? { value: type, label: type, icon: "help", color: "badge-neutral" }

  return (
    <div ref={ref} className={cn("relative inline-block", className)}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className={cn("badge inline-flex items-center gap-1 cursor-pointer hover:ring-1 hover:ring-foreground/20 transition-all", current.color)}
        title="Change account type"
      >
        <span className="material-symbols-rounded text-xs">{current.icon}</span>
        {current.label}
        <span className="material-symbols-rounded text-xs ml-0.5" style={{ fontSize: 10 }}>expand_more</span>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 bg-card border border-card-border rounded-lg shadow-lg py-1 min-w-[140px]"
          onClick={(e) => e.stopPropagation()}
        >
          {ACCOUNT_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => { onChangeType(t.value); setOpen(false) }}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-background-secondary transition-colors text-left",
                t.value === type && "bg-primary/10 text-primary"
              )}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
