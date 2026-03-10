"use client"

import Link from "next/link"

interface PortfolioEmptyProps {
  icon?: string
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  helpSteps?: Array<{ icon: string; text: string }>
  linkTo?: { label: string; href: string }
}

export function PortfolioEmpty({
  icon = "inbox",
  title,
  description,
  action,
  helpSteps,
  linkTo,
}: PortfolioEmptyProps) {
  return (
    <div className="bg-card border border-card-border rounded-xl py-16 px-6 text-center">
      <span
        className="material-symbols-rounded block mb-4 text-foreground-muted"
        style={{ fontSize: 48 }}
        aria-hidden="true"
      >
        {icon}
      </span>

      <h3 className="text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-foreground-muted max-w-sm mx-auto mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {helpSteps && helpSteps.length > 0 && (
        <div className="max-w-sm mx-auto mt-6 space-y-3 text-left">
          {helpSteps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-6 h-6 bg-background-secondary rounded-lg flex items-center justify-center text-[10px] text-foreground-muted flex-shrink-0">
                {index + 1}
              </div>
              <div className="flex items-center gap-2 pt-0.5">
                <span
                  className="material-symbols-rounded text-foreground-muted"
                  style={{ fontSize: 14 }}
                  aria-hidden="true"
                >
                  {step.icon}
                </span>
                <span className="text-foreground-muted text-sm">
                  {step.text}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn-secondary mt-6"
        >
          {action.label}
        </button>
      )}

      {linkTo && (
        <Link
          href={linkTo.href}
          className="inline-block mt-3 text-xs text-foreground-muted hover:text-primary transition-colors underline underline-offset-4"
        >
          {linkTo.label}
        </Link>
      )}
    </div>
  )
}
