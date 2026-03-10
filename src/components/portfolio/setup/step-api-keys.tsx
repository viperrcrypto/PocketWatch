"use client"

import { useState } from "react"
import {
  useSetExternalService,
  useExternalServices,
} from "@/hooks/use-portfolio-tracker"

// ─── API Key Card ───

function ApiKeyCard({
  serviceName,
  displayName,
  icon,
  description,
  linkText,
  linkHref,
  isConfigured,
  optional = false,
}: {
  serviceName: string
  displayName: string
  icon: string
  description: string
  linkText: string
  linkHref: string
  isConfigured: boolean
  optional?: boolean
}) {
  const [apiKey, setApiKey] = useState("")
  const [saved, setSaved] = useState(isConfigured)
  const setService = useSetExternalService()

  const handleSave = () => {
    if (!apiKey.trim()) return
    setService.mutate(
      { name: serviceName, api_key: apiKey.trim() },
      {
        onSuccess: () => {
          setSaved(true)
          setApiKey("")
        },
      }
    )
  }

  return (
    <div className="bg-card border border-card-border rounded-xl p-5">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-rounded text-foreground-muted"
            style={{ fontSize: 20 }}
            aria-hidden="true"
          >
            {icon}
          </span>
          <span className="text-foreground text-sm font-semibold">
            {displayName}
          </span>
        </div>
        {saved ? (
          <span className="flex items-center gap-1 text-success text-[10px] font-medium tracking-wider">
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>check_circle</span>
            Configured
          </span>
        ) : (
          <span className="text-foreground-muted text-[10px] font-medium tracking-wider">
            {optional ? "Optional" : "Required"}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-foreground-muted text-sm mb-2">
        {description}
      </p>

      {/* External link */}
      <a
        href={linkHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground-muted hover:text-primary transition-colors inline-block mb-3 text-xs"
      >
        {linkText} &rarr;
      </a>

      {/* Input row or saved state */}
      {saved ? (
        <div className="flex items-center gap-2 mt-1">
          <span className="material-symbols-rounded text-success" style={{ fontSize: 16 }}>check</span>
          <span className="text-success text-sm">Key saved</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Paste your API key"
            className="flex-1 bg-transparent border-b border-card-border text-foreground py-2 outline-none focus:border-primary transition-colors placeholder:text-foreground-muted font-data text-sm"
          />
          <button
            onClick={handleSave}
            disabled={!apiKey.trim() || setService.isPending}
            className="btn-secondary px-4 py-2 text-xs"
          >
            {setService.isPending ? (
              <span className="material-symbols-rounded text-sm animate-spin">progress_activity</span>
            ) : (
              "Save"
            )}
          </button>
        </div>
      )}

      {setService.isError && (
        <p className="mt-2 text-error text-xs">
          {setService.error?.message || "Failed to save key."}
        </p>
      )}
    </div>
  )
}

// ─── Step 2: API Keys ───

export function StepApiKeys({ onNext, hasSharedKey }: { onNext: () => void; hasSharedKey?: boolean }) {
  const { data: services } = useExternalServices()

  const isServiceConfigured = (name: string): boolean => {
    const list = Array.isArray(services?.services)
      ? services.services
      : Array.isArray(services)
        ? services
        : []
    return list.some(
      (s: { name?: string }) => s.name?.toLowerCase() === name.toLowerCase()
    )
  }

  const zerionConfigured = isServiceConfigured("zerion") || !!hasSharedKey

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Connect Services
      </h1>
      <p className="text-foreground-muted max-w-lg text-center mb-8 text-sm">
        Zerion powers your portfolio — real-time balances, prices, and
        multi-chain data. Etherscan adds transaction history and contract data
        on Ethereum mainnet.
      </p>

      {hasSharedKey ? (
        <div className="max-w-xl w-full mx-auto p-5 border border-success/25 bg-success-muted rounded-xl">
          <div className="flex items-center gap-3">
            <span className="material-symbols-rounded text-success" style={{ fontSize: 20 }}>check_circle</span>
            <div>
              <p className="text-foreground text-sm font-semibold">Platform Zerion Key Active</p>
              <p className="text-foreground-muted mt-0.5 text-xs">
                Your admin has configured a shared Zerion API key. You can proceed without adding your own.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-xl w-full mx-auto">
          <ApiKeyCard
            serviceName="zerion"
            displayName="ZERION"
            icon="account_balance_wallet"
            description="Real-time balances and prices across all supported chains — Ethereum, Solana, Bitcoin, Arbitrum, Base, Polygon, and more."
            linkText="Get your free API key at zerion.io/api"
            linkHref="https://zerion.io/api"
            isConfigured={zerionConfigured}
          />
          <div className="mt-4" />
          <ApiKeyCard
            serviceName="etherscan"
            displayName="ETHERSCAN"
            icon="search"
            description="Transaction history and contract data on Ethereum mainnet."
            linkText="Get your free API key at etherscan.io/myapikey"
            linkHref="https://etherscan.io/myapikey"
            isConfigured={isServiceConfigured("etherscan")}
            optional
          />
          <p className="mt-4 text-foreground-muted text-center text-xs">
            Additional integrations (CoinGecko, Alchemy) can be added later in Settings.
          </p>
        </div>
      )}

      <div className="flex flex-col items-center gap-3 mt-8">
        <button
          onClick={onNext}
          disabled={!zerionConfigured}
          className="btn-primary px-6 py-3"
        >
          Continue
        </button>
        {!zerionConfigured && (
          <button
            onClick={onNext}
            className="text-foreground-muted hover:text-foreground transition-colors text-xs"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}
