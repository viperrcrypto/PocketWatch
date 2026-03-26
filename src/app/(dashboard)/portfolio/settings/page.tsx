"use client"

import { PortfolioPageHeader } from "@/components/portfolio/portfolio-page-header"
import { SyncDiagnosticsSection } from "@/components/portfolio/settings/sync-diagnostics-section"
import { SolanaKeyWarning } from "@/components/portfolio/settings/solana-key-warning"
import { ApiKeysSection } from "@/components/portfolio/settings/api-keys-section"
import { ExchangeConnectionsSection } from "@/components/portfolio/settings/exchange-connections-section"
import { DataManagementSection } from "@/components/portfolio/settings/data-management-section"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PortfolioPageHeader
        title="Crypto Settings"
        subtitle="API keys, exchange connections, and sync controls"
      />

      {/* Section 0: History Sync Diagnostics */}
      <SyncDiagnosticsSection />

      {/* Solana / Helius key warning (auto-hides when not needed) */}
      <SolanaKeyWarning onAddHeliusKey={() => {
        document.getElementById("api-keys-section")?.scrollIntoView({ behavior: "smooth" })
      }} />

      {/* Section 1: API Keys */}
      <div id="api-keys-section">
        <ApiKeysSection />
      </div>

      {/* Section 2: Exchange Connections */}
      <ExchangeConnectionsSection />

      {/* Section 3: Data Management */}
      <DataManagementSection />
    </div>
  )
}
