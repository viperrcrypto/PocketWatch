"use client"

import { memo } from "react"

interface HeaderProps {
  title?: string
  onMenuClick?: () => void
}

export const Header = memo(function Header({ title, onMenuClick }: HeaderProps) {
  return (
    <header className="lg:hidden h-12 flex items-center justify-between px-4 sticky top-0 z-30 bg-background-secondary">
      <div className="flex items-center gap-4 flex-shrink-0">
        <button
          onClick={onMenuClick}
          aria-label="Open navigation menu"
          className="p-2 -ml-2 rounded-lg hover:bg-background-secondary transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <span className="material-symbols-rounded text-xl text-foreground-muted" aria-hidden="true">menu</span>
        </button>

        {title && (
          <h1 className="text-sm font-semibold text-foreground">
            {title}
          </h1>
        )}
      </div>
    </header>
  )
})

Header.displayName = "Header"
