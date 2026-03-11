"use client"

import Link from "next/link"

interface SetupRequiredStateProps {
  service: "zerion" | "helius" | "alchemy"
  feature: string
}

const SERVICE_INFO: Record<string, { name: string; url: string; description: string }> = {
  zerion: {
    name: "Zerion",
    url: "https://zerion.io/developers",
    description: "Multi-chain wallet balances, portfolio history, staking positions, and token data",
  },
  helius: {
    name: "Helius",
    url: "https://dev.helius.xyz",
    description: "Solana RPC, transaction history, and token metadata",
  },
  alchemy: {
    name: "Alchemy",
    url: "https://www.alchemy.com",
    description: "EVM transaction syncing and LP position tracking",
  },
}

export function SetupRequiredState({ service, feature }: SetupRequiredStateProps) {
  const info = SERVICE_INFO[service]

  return (
    <div className="card p-10 text-center border border-card-border">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
        <span className="material-symbols-rounded text-primary" style={{ fontSize: 28 }}>key</span>
      </div>

      <h3 className="font-semibold text-lg tracking-tight mb-2">
        {info.name} API Key Required
      </h3>

      <p className="text-foreground-muted text-sm max-w-md mx-auto mb-2 leading-relaxed">
        To view {feature}, connect your free <strong>{info.name}</strong> API key.
      </p>
      <p className="text-foreground-muted text-xs max-w-md mx-auto mb-6">
        {info.description}.
      </p>

      <div className="flex items-center justify-center gap-3">
        <Link
          href="/portfolio/settings"
          className="btn-primary inline-flex items-center gap-2"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>settings</span>
          Add API Key
        </Link>
        <a
          href={info.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-secondary inline-flex items-center gap-2 text-sm"
        >
          Get a free key
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>open_in_new</span>
        </a>
      </div>
    </div>
  )
}
