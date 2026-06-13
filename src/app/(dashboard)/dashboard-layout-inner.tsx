"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { usePortfolioSettings } from "@/hooks/portfolio/use-services"
import { useAutoLock } from "@/hooks/use-auto-lock"
import { useChat } from "@/hooks/use-chat"
import dynamic from "next/dynamic"
const Sidebar = dynamic(() => import("@/components/layout/sidebar").then((m) => m.Sidebar), { ssr: false })
import { Header } from "@/components/layout/header"
import { BottomNavSectionSwitcher } from "@/components/layout/bottom-nav-section-switcher"
import { TabletRailSidebar } from "@/components/layout/tablet-rail-sidebar"
import { PageErrorBoundary } from "@/components/error-boundary"
import { GlobalSyncPoller } from "@/components/global-sync-poller"
import { GlobalSyncIndicator } from "@/components/global-sync-indicator"
import { FinanceSyncPoller } from "@/components/finance-sync-poller"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ChatToggle } from "@/components/chat/chat-toggle"
import { GlobalCommandPalette } from "@/components/command/global-command-palette"

export function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: portfolioSettings } = usePortfolioSettings()
  useAutoLock(portfolioSettings?.settings?.autoLockMinutes ?? 5)
  const { isOpen: chatOpen } = useChat()

  // In the Tauri desktop shell the native overlay titlebar (traffic lights) sits
  // over the top-left of the web content. Flag it so CSS can inset the app below
  // a draggable titlebar strip instead of letting the lights overlap the logo.
  // Also route external links to the system browser: target="_blank" opens a new
  // webview (a dead window in Tauri), so intercept external-host clicks and turn
  // them into a same-window navigation, which the Rust on_navigation hook catches
  // and opens in the system browser. Booking links + OAuth sign-in both rely on
  // this; without it they silently no-op or strand the window on a third-party page.
  useEffect(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return
    document.documentElement.setAttribute("data-tauri", "")

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null
      if (!anchor) return
      let url: URL
      try {
        url = new URL(anchor.href, window.location.href)
      } catch {
        return
      }
      const isExternal =
        (url.protocol === "http:" || url.protocol === "https:") && url.host !== window.location.host
      if (isExternal) {
        e.preventDefault()
        window.location.href = url.href
      }
    }
    document.addEventListener("click", onClick, true)
    return () => document.removeEventListener("click", onClick, true)
  }, [])

  return (
    <div className="min-h-screen page-bg">
      <GlobalSyncPoller />
      <FinanceSyncPoller />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <TabletRailSidebar onOpenSidebar={() => setSidebarOpen(true)} />

      {/* Main content area */}
      <div
        data-app-main
        className={cn(
          "md:pl-14 lg:pl-64 transition-[padding] duration-300",
          chatOpen && "lg:pr-[400px]",
        )}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main
          id="main-content"
          className="px-4 py-4 md:py-6 md:px-4 max-w-[1400px] mx-auto overflow-x-hidden pb-[72px] md:pb-0 safe-area-landscape"
        >
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom navigation — phone only */}
      <BottomNavSectionSwitcher />

      {/* PocketLLM Chat */}
      <ChatToggle />
      <ChatPanel />

      {/* Cmd/Ctrl+K global search */}
      <GlobalCommandPalette />

      {/* Background sync status (visible on every page) */}
      <GlobalSyncIndicator />
    </div>
  )
}
