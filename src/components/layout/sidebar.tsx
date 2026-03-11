"use client"

import { memo } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { SidebarNavSection } from "./sidebar-nav-section"
import { SidebarEditControls } from "./sidebar-edit-controls"
import {
  useSidebarPrefs,
  getOrderedItems,
  NAV_CATEGORIES,
} from "@/hooks/use-sidebar-prefs"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export const Sidebar = memo(function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const {
    prefs,
    isEditing,
    setIsEditing,
    moveItem,
    toggleVisibility,
    moveCategory,
    resetToDefaults,
  } = useSidebarPrefs()

  const handleLock = async () => {
    try {
      await fetch("/api/auth/lock", { method: "POST" })
    } catch {
      // Best-effort
    }
    window.location.href = "/"
  }

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <button
          type="button"
          className="fixed inset-0 bg-black/40 z-40 lg:hidden cursor-default"
          onClick={onClose}
          aria-label="Close navigation menu"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-card border-r border-card-border z-50 transition-transform duration-200 lg:translate-x-0 flex flex-col",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo + Theme Toggle */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-card-border flex-shrink-0">
          <Link href="/portfolio" className="flex items-center gap-2.5 group">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" aria-hidden="true">
              <defs>
                <linearGradient id="pw-sidebar" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              {/* Chain/ring */}
              <path d="M12 1.5v2" stroke="url(#pw-sidebar)" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="12" cy="1.8" r="1" fill="none" stroke="url(#pw-sidebar)" strokeWidth="0.8"/>
              {/* Watch body */}
              <circle cx="12" cy="13" r="9.5" fill="url(#pw-sidebar)"/>
              {/* Inner face */}
              <circle cx="12" cy="13" r="7.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.3"/>
              {/* Hour hand */}
              <line x1="12" y1="13" x2="12" y2="8.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
              {/* Minute hand */}
              <line x1="12" y1="13" x2="16" y2="13" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
              {/* Center dot */}
              <circle cx="12" cy="13" r="1" fill="white"/>
              {/* Hour markers */}
              <circle cx="12" cy="6.5" r="0.6" fill="white" opacity="0.5"/>
              <circle cx="18.5" cy="13" r="0.6" fill="white" opacity="0.5"/>
              <circle cx="12" cy="19.5" r="0.6" fill="white" opacity="0.5"/>
              <circle cx="5.5" cy="13" r="0.6" fill="white" opacity="0.5"/>
            </svg>
            <span className="text-sm font-semibold tracking-wide text-foreground">
              Pocket<span className="font-normal">Watch</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
                isEditing
                  ? "text-primary bg-primary-muted"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              )}
              aria-label="Customize sidebar"
              title="Customize sidebar"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>tune</span>
            </button>
          </div>
        </div>

        {/* Navigation or Edit Mode */}
        {isEditing ? (
          <SidebarEditControls
            prefs={prefs}
            moveItem={moveItem}
            toggleVisibility={toggleVisibility}
            moveCategory={moveCategory}
            resetToDefaults={resetToDefaults}
            onDone={() => setIsEditing(false)}
          />
        ) : (
          <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
            {prefs.categoryOrder.map((catKey, idx) => {
              const category = NAV_CATEGORIES[catKey]
              if (!category) return null
              const items = getOrderedItems(catKey, prefs)
              if (items.length === 0) return null
              const baseHref = catKey === "finance" ? "/finance" : "/portfolio"

              return (
                <div key={catKey}>
                  {idx > 0 && <hr className="border-card-border my-3 mx-3" />}
                  <SidebarNavSection
                    label={category.label}
                    items={items}
                    pathname={pathname}
                    baseHref={baseHref}
                    onClose={onClose}
                  />
                </div>
              )
            })}
          </nav>
        )}

        {/* Bottom section */}
        <div className="px-3 py-3 border-t border-card-border flex-shrink-0 space-y-1">
          {/* Credits */}
          <div className="flex items-center gap-2 px-3 py-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-foreground-muted flex-shrink-0" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="text-[11px] text-foreground-muted">
              Built by{" "}
              <a href="https://x.com/viperr" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">@viperr</a>
              {" & "}
              <a href="https://x.com/0xXinu" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">@0xXinu</a>
            </span>
          </div>

          <button
            onClick={handleLock}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-foreground-muted hover:text-foreground hover:bg-background-secondary"
          >
            <span className="material-symbols-rounded text-lg" aria-hidden="true">lock_open</span>
            <span>Lock</span>
          </button>
        </div>
      </aside>
    </>
  )
})

Sidebar.displayName = "Sidebar"
