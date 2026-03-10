"use client"

import { useMemo } from "react"
import { useExternalServices, useSyncProgress } from "@/hooks/use-portfolio-tracker"
import { getServicesList } from "./settings-utils"

export function SolanaKeyWarning({ onAddHeliusKey }: { onAddHeliusKey: () => void }) {
  const { data: servicesData } = useExternalServices()
  const { data: syncData } = useSyncProgress({ advance: false, reconstruct: false, autoStart: false })

  const services = useMemo(() => getServicesList(servicesData), [servicesData])
  const allRows = syncData?.progress ?? []
  const solanaRows = allRows.filter((r) => r.chain === "SOLANA")
  const solanaMissingKey = solanaRows.some((r) => r.lastErrorCode === "helius_key_missing")
  const hasSolanaWallets = solanaRows.length > 0
  const heliusConfigured = services.some((s) => s.name === "helius" && s.verified)

  if (!hasSolanaWallets || (heliusConfigured && !solanaMissingKey)) return null

  return (
    <div className="bg-amber-50 border border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-rounded text-amber-600 dark:text-amber-500" style={{ fontSize: 20 }}>key_off</span>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            Solana wallet history requires a Helius API key
          </p>
          <p className="text-xs text-foreground-muted">
            {solanaMissingKey
              ? `${solanaRows.length} Solana sync${solanaRows.length > 1 ? "s" : ""} skipped — add a Helius key to enable transaction history.`
              : "You have Solana wallets but no verified Helius key. Solana sync will be skipped."}
          </p>
        </div>
      </div>
      <button
        onClick={onAddHeliusKey}
        className="px-3 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-500/10 transition-colors flex-shrink-0"
      >
        Add Helius Key
      </button>
    </div>
  )
}
