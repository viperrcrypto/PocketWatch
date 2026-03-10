"use client"

import { memo, useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"

interface NavItem {
  id: string
  label: string
  href: string
  icon: string
}

const PORTFOLIO_NAV_ITEMS: NavItem[] = [
  { id: "portfolio",    label: "Overview",      href: "/portfolio",                    icon: "pie_chart" },
  { id: "balances",     label: "Balances",      href: "/portfolio/balances",           icon: "account_balance_wallet" },
  { id: "history",      label: "Activity",      href: "/portfolio/history",            icon: "history" },
  { id: "accounts",     label: "Wallets",       href: "/portfolio/accounts",           icon: "wallet" },
  { id: "address-book", label: "Address Book",  href: "/portfolio/address-book",       icon: "contacts" },
  { id: "airdrops",     label: "Airdrops",      href: "/portfolio/airdrops",           icon: "redeem" },
  { id: "staking",      label: "Staking",       href: "/portfolio/staking",            icon: "layers" },
  { id: "nfts",         label: "NFTs",          href: "/portfolio/nfts",               icon: "collections" },
  { id: "settings",     label: "Settings",      href: "/portfolio/settings",           icon: "settings" },
]

const TRACKER_NAV_ITEMS: NavItem[] = [
  { id: "tracker-feed",      label: "Feed",       href: "/tracker",           icon: "rss_feed" },
  { id: "tracker-wallets",   label: "Wallets",    href: "/tracker/wallets",   icon: "account_balance_wallet" },
  { id: "tracker-analytics", label: "Analytics",   href: "/tracker/analytics", icon: "analytics" },
]

const FINANCE_NAV_ITEMS: NavItem[] = [
  { id: "fin-dashboard",     label: "Dashboard",      href: "/finance",                icon: "monitoring" },
  { id: "fin-insights",      label: "Insights",       href: "/finance/insights",       icon: "analytics" },
  { id: "fin-accounts",      label: "Accounts",       href: "/finance/accounts",       icon: "account_balance" },
  { id: "fin-transactions",  label: "Transactions",   href: "/finance/transactions",   icon: "receipt_long" },
  { id: "fin-budgets",       label: "Budgets",        href: "/finance/budgets",        icon: "savings" },
  { id: "fin-investments",   label: "Investments",    href: "/finance/investments",    icon: "show_chart" },
  { id: "fin-subscriptions", label: "Subscriptions",  href: "/finance/subscriptions",  icon: "autorenew" },
  { id: "fin-cards",         label: "Credit Cards",   href: "/finance/cards",          icon: "credit_card" },
  { id: "fin-net-worth",     label: "Net Worth",      href: "/finance/net-worth",      icon: "trending_up" },
  { id: "fin-settings",      label: "Settings",       href: "/finance/settings",       icon: "settings" },
]

// Clock component showing UTC + local time
function ClockDisplay() {
  const [utcTime, setUtcTime] = useState<string | null>(null)
  const [localTime, setLocalTime] = useState<string | null>(null)
  const [tzAbbr, setTzAbbr] = useState("Local")

  useEffect(() => {
    const updateTime = () => {
      const now = new Date()
      setUtcTime(
        now.toLocaleTimeString("en-US", {
          timeZone: "UTC",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      )
      const localStr = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
      setLocalTime(localStr)
      // Extract timezone abbreviation (e.g. "PST", "EST")
      const tzParts = now.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ")
      setTzAbbr(tzParts[tzParts.length - 1] ?? "Local")
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="flex flex-col items-end gap-0 px-1.5 py-0.5 rounded-lg bg-background-secondary whitespace-nowrap"
      style={{ visibility: utcTime ? "visible" : "hidden" }}
    >
      <span className="font-data text-[9px] font-medium tracking-wide text-foreground-secondary">
        {utcTime} <span className="text-foreground-muted">UTC</span>
      </span>
      <span className="font-data text-[9px] font-medium tracking-wide text-foreground-secondary">
        {localTime} <span className="text-foreground-muted">{tzAbbr}</span>
      </span>
    </div>
  )
}

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export const Sidebar = memo(function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
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
        {/* Logo + UTC Clock */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-card-border flex-shrink-0">
          <Link href="/portfolio" className="flex items-center gap-2.5 group">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="flex-shrink-0" aria-hidden="true">
              <defs>
                <linearGradient id="wt-sidebar" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#22d3ee"/>
                </linearGradient>
              </defs>
              <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#wt-sidebar)"/>
              <polyline points="4.5,16 8,9 12,14 16,7 19.5,4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <polyline points="16.5,4 19.5,4 19.5,7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
              <line x1="4.5" y1="19.5" x2="19.5" y2="19.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
            </svg>
            <span className="text-base font-semibold tracking-wide text-foreground">
              Wealth<span className="font-normal">Tracker</span>
            </span>
          </Link>
          <ClockDisplay />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          <div className="px-3 mb-3">
            <p className="text-[10px] font-semibold tracking-widest text-foreground-muted uppercase">
              Portfolio
            </p>
          </div>

          {PORTFOLIO_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/portfolio" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "text-primary bg-primary-muted"
                    : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <span
                  className={cn("material-symbols-rounded text-lg", isActive && "filled")}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}

          <hr className="border-card-border my-3 mx-3" />

          <div className="px-3 mb-3">
            <p className="text-[10px] font-semibold tracking-widest text-foreground-muted uppercase">
              Tracker
            </p>
          </div>

          {TRACKER_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/tracker" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "text-primary bg-primary-muted"
                    : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <span
                  className={cn("material-symbols-rounded text-lg", isActive && "filled")}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}

          <hr className="border-card-border my-3 mx-3" />

          <div className="px-3 mb-3">
            <p className="text-[10px] font-semibold tracking-widest text-foreground-muted uppercase">
              Finance
            </p>
          </div>

          {FINANCE_NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/finance" && pathname.startsWith(item.href))

            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "text-primary bg-primary-muted"
                    : "text-foreground-muted hover:text-foreground hover:bg-background-secondary"
                )}
              >
                <span
                  className={cn("material-symbols-rounded text-lg", isActive && "filled")}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-4 border-t border-card-border flex-shrink-0 space-y-0.5">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-foreground-muted hover:text-foreground hover:bg-background-secondary"
          >
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>GitHub</span>
            <span className="material-symbols-rounded text-xs ml-auto opacity-40" aria-hidden="true">open_in_new</span>
          </a>
          <div className="flex items-center gap-3 px-3 py-1">
            <ThemeToggle />
            <span className="text-xs text-foreground-muted">Theme</span>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-foreground-muted hover:text-error hover:bg-error-muted"
          >
            <span className="material-symbols-rounded text-lg" aria-hidden="true">logout</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  )
})

Sidebar.displayName = "Sidebar"
