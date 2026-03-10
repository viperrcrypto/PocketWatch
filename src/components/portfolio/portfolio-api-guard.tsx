"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { useExternalServices } from "@/hooks/use-portfolio-tracker"

interface PortfolioApiGuardProps {
  children: ReactNode
  requiredKeys?: string[]
  featureDescription?: string
}

export function PortfolioApiGuard({
  children,
  requiredKeys = [],
  featureDescription,
}: PortfolioApiGuardProps) {
  const { data, isLoading } = useExternalServices()

  // Don't block rendering while loading
  if (isLoading) return <>{children}</>

  // Parse configured service names from the response
  // API returns { services: [{name, api_key, ...}] }
  const configuredKeys: string[] = []
  if (data) {
    const serviceList = Array.isArray((data as any)?.services)
      ? (data as any).services
      : Array.isArray(data) ? data : []
    for (const svc of serviceList) {
      if (svc && typeof svc === "object" && svc.name) {
        configuredKeys.push(String(svc.name).toLowerCase())
      }
    }
  }

  // Check which required keys are missing
  const missingKeys = requiredKeys.filter(
    (key) => !configuredKeys.includes(key.toLowerCase())
  )

  // All keys present - render children
  if (missingKeys.length === 0) return <>{children}</>

  // Render missing-keys card
  return (
    <div className="bg-card border border-card-border rounded-xl py-16 px-6 text-center">
      <span
        className="material-symbols-rounded block mb-4 text-foreground-muted"
        style={{ fontSize: 48 }}
        aria-hidden="true"
      >
        key
      </span>

      <h3 className="text-lg font-semibold text-foreground mb-2">
        API Keys Required
      </h3>

      <p className="text-foreground-muted max-w-md mx-auto mb-6 text-sm">
        {featureDescription ||
          "This feature requires API keys to be configured."}
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
        {missingKeys.map((key) => (
          <span
            key={key}
            className="border border-card-border rounded-full px-3 py-1 text-xs text-foreground-muted"
          >
            {key}
          </span>
        ))}
      </div>

      <Link
        href="/portfolio/settings"
        className="btn-primary px-6 py-2.5 inline-block"
      >
        Configure API Keys
      </Link>
    </div>
  )
}
