"use client"

import { ReactNode } from "react"

interface PortfolioPageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
}

export function PortfolioPageHeader({ title, subtitle, actions }: PortfolioPageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1
          className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground"
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 font-mono text-sm text-foreground-muted tracking-wide">
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
