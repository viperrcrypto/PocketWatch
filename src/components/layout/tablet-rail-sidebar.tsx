"use client"

import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { SECTION_TABS, getActiveSection } from "./nav-constants"

interface TabletRailSidebarProps {
  onOpenSidebar: () => void
}

export function TabletRailSidebar({ onOpenSidebar }: TabletRailSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const activeSection = getActiveSection(pathname)

  return (
    <aside className="hidden md:flex lg:hidden fixed left-0 top-0 h-full w-14 flex-col items-center py-3 gap-1 border-r border-card-border bg-card z-50">
      {/* Section icons */}
      <div className="flex flex-col items-center gap-1 flex-1">
        {SECTION_TABS.map((tab) => {
          const isActive = activeSection === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => router.push(tab.root)}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                isActive
                  ? "bg-primary-muted text-primary"
                  : "text-foreground-muted hover:bg-background-secondary hover:text-foreground",
              )}
              aria-label={tab.label}
              title={tab.label}
            >
              <span
                className={cn(
                  "material-symbols-rounded",
                  isActive && "filled",
                )}
                style={{ fontSize: 22 }}
              >
                {tab.icon}
              </span>
            </button>
          )
        })}
      </div>

      {/* Open full sidebar */}
      <button
        onClick={onOpenSidebar}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-foreground-muted hover:bg-background-secondary hover:text-foreground transition-colors"
        aria-label="Open full menu"
        title="Menu"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 22 }}>
          menu
        </span>
      </button>
    </aside>
  )
}
