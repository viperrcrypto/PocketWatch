"use client"

import { ReactNode } from "react"

interface FinancePageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function FinancePageHeader({ title, subtitle, actions }: FinancePageHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 font-data text-xs text-foreground-muted tracking-wide">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
