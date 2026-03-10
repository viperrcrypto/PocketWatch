"use client"

import { useState } from "react"
import Link from "next/link"
import { useExternalServices } from "@/hooks/use-portfolio-tracker"

export function ApiKeysBanner() {
  const { data: services } = useExternalServices()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const configuredNames = new Set<string>()
  const serviceList = Array.isArray(services?.services) ? services.services : []
  serviceList.forEach((s: any) => configuredNames.add(s?.name?.toLowerCase()))

  // Show banner when critical keys are missing — Zerion is needed for
  // portfolio chart history, staking positions, and token balances.
  if (!services) return null // still loading
  const missing: string[] = []
  if (!configuredNames.has("zerion")) missing.push("Zerion")
  if (missing.length === 0) return null

  return (
    <div
      className="bg-card border border-warning/25 px-5 py-3 flex items-center justify-between gap-4 rounded-xl"
      style={{ borderLeft: "2px solid var(--warning)" }}
    >
      <div className="flex items-center gap-3">
        <span className="material-symbols-rounded text-warning text-lg">warning</span>
        <p className="text-sm text-warning">
          {missing.join(", ")} API key{missing.length > 1 ? "s are" : " is"} not
          configured. Portfolio history and token balances may be incomplete.
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <Link
          href="/portfolio/settings"
          className="btn-secondary text-xs tracking-wide"
          style={{ height: 32, padding: "0 14px", borderColor: "var(--warning)", color: "var(--warning)" }}
        >
          Configure Keys
        </Link>
        <button
          onClick={() => setDismissed(true)}
          className="text-foreground-muted hover:text-foreground transition-colors"
        >
          <span className="material-symbols-rounded text-sm">close</span>
        </button>
      </div>
    </div>
  )
}
