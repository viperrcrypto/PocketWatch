"use client"

import { cn } from "@/lib/utils"
import { SETTINGS_TABS, type SettingsTabId } from "./settings-constants"

interface SettingsTabBarProps {
  activeTab: SettingsTabId
  onTabChange: (tab: SettingsTabId) => void
}

export function SettingsTabBar({ activeTab, onTabChange }: SettingsTabBarProps) {
  return (
    <div className="border-b border-card-border -mx-1 overflow-x-auto scrollbar-hide">
      <nav className="flex items-center gap-0 min-w-max px-1" role="tablist">
        {SETTINGS_TABS.map((tab) => {
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm transition-colors border-b-2 whitespace-nowrap",
                isActive
                  ? "text-primary border-b-primary font-medium"
                  : "text-foreground-muted border-b-transparent hover:text-foreground"
              )}
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 18 }}
                aria-hidden="true"
              >
                {tab.icon}
              </span>
              {tab.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
