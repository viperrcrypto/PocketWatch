"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const TRACKER_TABS = [
  { href: "/tracker",           label: "Feed",      icon: "rss_feed" },
  { href: "/tracker/wallets",   label: "Wallets",   icon: "account_balance_wallet" },
  { href: "/tracker/analytics", label: "Analytics",  icon: "analytics" },
]

export default function TrackerLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-0 fade-in">
      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-card-border px-1 -mx-1">
        {TRACKER_TABS.map((tab) => {
          const isActive = tab.href === "/tracker"
            ? pathname === "/tracker"
            : pathname.startsWith(tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "text-foreground border-primary"
                  : "text-foreground-muted border-transparent hover:text-foreground hover:border-card-border"
              )}
            >
              <span
                className={cn("material-symbols-rounded", isActive && "filled")}
                style={{ fontSize: 18 }}
                aria-hidden="true"
              >
                {tab.icon}
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>

      <div className="pt-6">{children}</div>
    </div>
  )
}
