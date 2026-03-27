"use client"

import { memo } from "react"
import { usePathname, useRouter } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { fadeIn, durations } from "@/lib/motion"
import { ThemeToggle } from "@/components/theme-toggle"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { SidebarNavSection } from "./sidebar-nav-section"
import { SidebarEditControls } from "./sidebar-edit-controls"
import {
  useSidebarPrefs,
  getOrderedItems,
  NAV_CATEGORIES,
} from "@/hooks/use-sidebar-prefs"
import { useReviewCount } from "@/hooks/use-finance"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export const Sidebar = memo(function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { data: reviewCountData } = useReviewCount()
  const financeBadges = reviewCountData?.count ? { "fin-transactions": reviewCountData.count } : undefined
  const reduce = useReducedMotion()
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
      <AnimatePresence>
        {isOpen && (
          <motion.button
            type="button"
            className="fixed inset-0 bg-black/40 z-40 lg:hidden cursor-default"
            onClick={onClose}
            aria-label="Close navigation menu"
            variants={fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={reduce ? { duration: 0 } : { duration: durations.base }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 border-r border-card-border z-50 transition-transform duration-200 lg:translate-x-0 flex flex-col",
          "bg-card",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.04)", willChange: "transform" }}
      >
        {/* Logo + Theme Toggle */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-card-border flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center flex-shrink-0">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" className="text-foreground" aria-hidden="true">
                <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h1A1.5 1.5 0 0 1 7 2.5V5h2V2.5A1.5 1.5 0 0 1 10.5 1h1A1.5 1.5 0 0 1 13 2.5v2.382a.5.5 0 0 0 .276.447l.895.447A1.5 1.5 0 0 1 15 7.118V14.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 14.5v-3a.5.5 0 0 1 .146-.354l.854-.853V9.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v.793l.854.853A.5.5 0 0 1 7 11.5v3A1.5 1.5 0 0 1 5.5 16h-3A1.5 1.5 0 0 1 1 14.5V7.118a1.5 1.5 0 0 1 .83-1.342l.894-.447A.5.5 0 0 0 3 4.882zM4.5 2a.5.5 0 0 0-.5.5V3h2v-.5a.5.5 0 0 0-.5-.5zM6 4H4v.882a1.5 1.5 0 0 1-.83 1.342l-.894.447A.5.5 0 0 0 2 7.118V13h4v-1.293l-.854-.853A.5.5 0 0 1 5 10.5v-1A1.5 1.5 0 0 1 6.5 8h3A1.5 1.5 0 0 1 11 9.5v1a.5.5 0 0 1-.146.354l-.854.853V13h4V7.118a.5.5 0 0 0-.276-.447l-.895-.447A1.5 1.5 0 0 1 12 4.882V4h-2v1.5a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5zm4-1h2v-.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5zm4 11h-4v.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5zm-8 0H2v.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5z"/>
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Pocket<span className="text-foreground-muted font-normal">Watch</span>
            </span>
          </div>
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
              <span className="material-symbols-rounded icon-md" aria-hidden="true">tune</span>
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
          <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto overflow-x-visible">
            {prefs.categoryOrder.map((catKey, idx) => {
              const category = NAV_CATEGORIES[catKey]
              if (!category) return null
              const items = getOrderedItems(catKey, prefs)
              if (items.length === 0) return null
              const baseHref = catKey === "finance" ? "/finance" : catKey === "travel" ? "/travel" : catKey === "ai" ? "/chat" : catKey === "netWorth" ? "/net-worth" : "/portfolio"

              return (
                <div key={catKey}>
                  {idx > 0 && <div className="h-px bg-card-border mx-1 my-3 opacity-60" />}
                  <SidebarNavSection
                    label={category.label}
                    items={items}
                    pathname={pathname}
                    baseHref={baseHref}
                    onClose={onClose}
                    badges={catKey === "finance" ? financeBadges : undefined}
                  />
                </div>
              )
            })}
          </nav>
        )}

        {/* Bottom section */}
        <div className="px-3 py-3 border-t border-card-border flex-shrink-0 space-y-2">
          {/* Sponsor CTA */}
          <a
            href="https://x.com/messages/compose?recipient_id=viperr&text=Hey%20I%27d%20like%20to%20sponsor%20PocketWatch"
            target="_blank"
            rel="noopener noreferrer"
            className="group block mx-1 rounded-lg border border-dashed border-foreground-muted/20 hover:border-primary/40 transition-all duration-200 overflow-hidden"
          >
            <div className="px-3 py-2.5 flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--foreground-muted), color-mix(in srgb, var(--foreground-muted) 60%, transparent))", opacity: 0.15 }}
              >
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 14, opacity: 0.6 }}>handshake</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium text-foreground-muted/50 group-hover:text-foreground-muted transition-colors">Get your brand featured here</p>
                <p className="text-[9px] text-foreground-muted/30 group-hover:text-foreground-muted/50 transition-colors">DM @viperr on X</p>
              </div>
            </div>
          </a>

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

          <div className="flex items-center gap-1">
            <button
              onClick={handleLock}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              aria-label="Lock"
              title="Lock"
            >
              <span className="material-symbols-rounded text-lg" aria-hidden="true">lock_open</span>
            </button>
            <div className="w-px h-5 bg-card-border" />
            <NotificationBell />
            <div className="w-px h-5 bg-card-border" />
            <button
              onClick={() => { router.push("/settings"); onClose?.() }}
              className={cn(
                "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                pathname === "/settings"
                  ? "text-primary bg-primary-muted"
                  : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
              )}
              aria-label="System settings"
              title="System settings"
            >
              <span className="material-symbols-rounded text-lg" aria-hidden="true">settings</span>
            </button>
            <span className="ml-auto text-[10px] text-foreground-muted/40 tabular-nums" title={`Build ${process.env.NEXT_PUBLIC_BUILD_HASH}`}>
              v{process.env.NEXT_PUBLIC_BUILD_VERSION}
            </span>
          </div>
        </div>
      </aside>
    </>
  )
})

Sidebar.displayName = "Sidebar"
