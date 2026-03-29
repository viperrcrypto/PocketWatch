"use client"

import { SyncDiagnosticsSection } from "@/components/portfolio/settings/sync-diagnostics-section"
import { SolanaKeyWarning } from "@/components/portfolio/settings/solana-key-warning"
import { ApiKeysSection } from "@/components/portfolio/settings/api-keys-section"
import { ExchangeConnectionsSection } from "@/components/portfolio/settings/exchange-connections-section"
import { DataManagementSection } from "@/components/portfolio/settings/data-management-section"

export function DigitalAssetsSettingsTab() {
  return (
    <div className="space-y-6">
      <div id="sync-diagnostics">
        <SyncDiagnosticsSection />
      </div>

      <SolanaKeyWarning onAddHeliusKey={() => {
        document.getElementById("api-keys")?.scrollIntoView({ behavior: "smooth" })
      }} />

      <div id="api-keys">
        <ApiKeysSection />
      </div>

      <div id="exchange-connections">
        <ExchangeConnectionsSection />
      </div>

      <div id="data-management-portfolio">
        <DataManagementSection />
      </div>
    </div>
  )
}
