"use client"

import { Suspense, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SettingsTabBar } from "@/components/settings/settings-tab-bar"
import { SettingsSearch } from "@/components/settings/settings-search"
import { GeneralSettingsTab } from "@/components/settings/general-settings-tab"
import { FinanceSettingsTab } from "@/components/finance/settings/finance-settings-tab"
import { DigitalAssetsSettingsTab } from "@/components/settings/digital-assets-settings-tab"
import { TravelSettingsTab } from "@/components/settings/travel-settings-tab"
import { type SettingsTabId, SETTINGS_TABS } from "@/components/settings/settings-constants"

function SettingsPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawTab = searchParams.get("tab") ?? "general"
  const activeTab: SettingsTabId = SETTINGS_TABS.some((t) => t.id === rawTab)
    ? (rawTab as SettingsTabId)
    : "general"

  const handleTabChange = useCallback((tab: SettingsTabId) => {
    router.replace(`/settings?tab=${tab}`, { scroll: false })
  }, [router])

  const handleSearchNavigate = useCallback((tab: SettingsTabId, sectionId: string) => {
    router.replace(`/settings?tab=${tab}`, { scroll: false })
    // Wait for tab content to render, then scroll to section
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 50)
    })
  }, [router])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-foreground">Settings</h1>
        <p className="text-sm text-foreground-muted mt-1">
          Preferences, integrations, and data management
        </p>
      </div>

      <SettingsSearch onNavigate={handleSearchNavigate} />
      <SettingsTabBar activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === "general" && <GeneralSettingsTab />}
      {activeTab === "finance" && <FinanceSettingsTab />}
      {activeTab === "digital-assets" && <DigitalAssetsSettingsTab />}
      {activeTab === "travel" && <TravelSettingsTab />}
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageContent />
    </Suspense>
  )
}
