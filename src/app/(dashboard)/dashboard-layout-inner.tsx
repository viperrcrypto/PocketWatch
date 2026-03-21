"use client"

import { useState } from "react"
import { usePortfolioSettings } from "@/hooks/portfolio/use-services"
import { useAutoLock } from "@/hooks/use-auto-lock"
import { useChat } from "@/hooks/use-chat"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { PageErrorBoundary } from "@/components/error-boundary"
import { GlobalSyncPoller } from "@/components/global-sync-poller"
import { FinanceSyncPoller } from "@/components/finance-sync-poller"
import { ChatPanel } from "@/components/chat/chat-panel"
import { ChatToggle } from "@/components/chat/chat-toggle"

export function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { data: portfolioSettings } = usePortfolioSettings()
  useAutoLock(portfolioSettings?.settings?.autoLockMinutes ?? 5)
  const { isOpen: chatOpen } = useChat()

  return (
    <div className="min-h-screen fade-in-slow page-bg">
      <GlobalSyncPoller />
      <FinanceSyncPoller />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div
        className={`lg:pl-64 transition-[padding] duration-300 ${chatOpen ? "lg:pr-[400px]" : ""}`}
      >
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main id="main-content" className="px-4 py-4 md:py-6 md:px-4 max-w-[1400px] overflow-x-hidden has-bottom-nav">
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav onMoreClick={() => setSidebarOpen(true)} />

      {/* PocketLLM Chat */}
      <ChatToggle />
      <ChatPanel />
    </div>
  )
}
