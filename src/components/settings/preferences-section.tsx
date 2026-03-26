"use client"

import { useState, useEffect } from "react"
import { usePortfolioSettings, useUpdateSettings } from "@/hooks/portfolio/use-services"
import { useSyncLocalStorage } from "@/hooks/use-sync-settings"
import { ThemeToggle } from "@/components/theme-toggle"
import { CollapsibleSection } from "./collapsible-section"
import { CURRENCIES } from "@/components/portfolio/settings/settings-utils"

export function PreferencesSection() {
  const { data: settingsData, isLoading: settingsLoading } = usePortfolioSettings()
  const updateSettings = useUpdateSettings()
  const { enabled: bgSyncEnabled, setEnabled: setBgSyncEnabled } = useSyncLocalStorage()

  const [mainCurrency, setMainCurrency] = useState("")
  const [settingsInitialized, setSettingsInitialized] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)

  useEffect(() => {
    if (!settingsData || settingsInitialized) return
    const result = settingsData?.result || settingsData
    if (result && typeof result === "object") {
      const currency = (result as Record<string, unknown>).main_currency
      if (typeof currency === "string") setMainCurrency(currency)
      setSettingsInitialized(true)
    }
  }, [settingsData, settingsInitialized])

  const handleSaveSettings = () => {
    setSettingsSaved(false)
    updateSettings.mutate(
      { main_currency: mainCurrency },
      { onSuccess: () => setSettingsSaved(true) }
    )
  }

  return (
    <CollapsibleSection
      title="Preferences"
      subtitle="Display currency, theme, and sync settings"
      defaultOpen
    >
      {settingsLoading ? (
        <div className="p-5 space-y-4">
          <div>
            <div className="w-24 h-3 animate-shimmer rounded mb-2" />
            <div className="w-48 h-10 animate-shimmer rounded-lg" />
          </div>
        </div>
      ) : (
        <div className="p-5 space-y-6">
          {/* Main Currency */}
          <div>
            <label className="block mb-2 text-xs font-semibold text-foreground-muted">
              Main Currency
            </label>
            <div className="relative w-full max-w-xs">
              <select
                value={mainCurrency}
                onChange={(e) => {
                  setMainCurrency(e.target.value)
                  setSettingsSaved(false)
                }}
                className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2.5 px-3 pr-8 text-foreground transition-colors appearance-none cursor-pointer text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} className="bg-card text-foreground">
                    {c}
                  </option>
                ))}
              </select>
              <span className="material-symbols-rounded absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted text-sm pointer-events-none">expand_more</span>
            </div>
          </div>

          {/* Theme */}
          <div>
            <label className="block mb-2 text-xs font-semibold text-foreground-muted">
              Theme
            </label>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <span className="text-sm text-foreground-muted">
                Toggle between light and dark mode
              </span>
            </div>
          </div>

          {/* Background Sync */}
          <div>
            <label className="block mb-2 text-xs font-semibold text-foreground-muted">
              Background Sync
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={bgSyncEnabled}
                onClick={() => setBgSyncEnabled(!bgSyncEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${bgSyncEnabled ? "bg-primary" : "bg-card-border"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${bgSyncEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
              <span className="text-sm text-foreground-muted">
                {bgSyncEnabled
                  ? "Transaction history syncs automatically in the background"
                  : "Background sync disabled — only syncs when on Portfolio pages"}
              </span>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={handleSaveSettings}
              disabled={updateSettings.isPending}
              className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm font-semibold"
            >
              {updateSettings.isPending ? "Saving..." : "Save Changes"}
            </button>
            {settingsSaved && (
              <span className="flex items-center gap-1.5 text-success">
                <span className="material-symbols-rounded text-sm">check_circle</span>
                <span className="text-xs font-medium">Saved</span>
              </span>
            )}
            {updateSettings.isError && (
              <span className="text-error text-xs">
                {updateSettings.error?.message || "Failed to save"}
              </span>
            )}
          </div>
        </div>
      )}
    </CollapsibleSection>
  )
}
