"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav"
import { PageErrorBoundary } from "@/components/error-boundary"
import { GlobalSyncPoller } from "@/components/global-sync-poller"

export function DashboardLayoutInner({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen fade-in-slow bg-background-secondary">
      <GlobalSyncPoller />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content area */}
      <div className="lg:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main id="main-content" className="px-4 py-4 md:py-6 md:px-4 max-w-[1400px] overflow-x-hidden has-bottom-nav">
          <PageErrorBoundary>
            {children}
          </PageErrorBoundary>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav onMoreClick={() => setSidebarOpen(true)} />
    </div>
  )
}
