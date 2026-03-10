"use client"

import { memo } from "react"
import { UserButton } from "./header/user-button"
import { NewFormIndicator, NotificationBell } from "./header/notifications"

interface HeaderProps {
  title?: string
  onMenuClick?: () => void
}

export const Header = memo(function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header
      className="h-16 flex items-center justify-between px-4 sticky top-0 z-30 bg-glass-bg border-b border-glass-border"
      style={{
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      <div className="flex items-center gap-4 flex-shrink-0">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-background-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <span className="material-symbols-rounded text-xl text-foreground-muted" aria-hidden="true">menu</span>
        </button>

        {/* Page title */}
        {title && (
          <h1 className="text-sm font-semibold text-foreground">
            {title}
          </h1>
        )}
      </div>

      {/* New Form Indicator / Crypto Ticker - fills remaining space */}
      <NewFormIndicator />

      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notification Bell */}
        <NotificationBell />
        {/* User Button */}
        <UserButton />
      </div>
    </header>
  )
})

Header.displayName = "Header"
