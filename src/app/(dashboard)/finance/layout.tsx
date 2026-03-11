"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { FINANCE_NAV_TABS } from "@/lib/portfolio/nav"
import { useFinanceAccounts } from "@/hooks/use-finance"

/**
 * Prefetch essential finance data in the layout.
 * Accounts are needed across most finance tabs.
 */
function FinancePrefetch() {
  useFinanceAccounts()
  return null
}

function FinanceNav() {
  const pathname = usePathname()

  const activeTab = FINANCE_NAV_TABS.filter((tab) => {
    if (tab.href === "/finance") return pathname === "/finance"
    return pathname === tab.href || pathname.startsWith(tab.href + "/")
  }).sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <div className="border-b border-card-border -mx-1 overflow-x-auto scrollbar-hide">
      <nav className="flex items-center gap-0 min-w-max px-1" role="tablist">
        {FINANCE_NAV_TABS.map((tab) => {
          const isActive = activeTab?.href === tab.href

          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "flex items-center gap-2 px-4 py-3 transition-colors duration-200 border-b-2 whitespace-nowrap text-sm",
                isActive
                  ? "text-primary border-b-primary font-medium"
                  : "text-foreground-muted border-b-transparent hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "material-symbols-rounded transition-colors duration-200",
                  isActive ? "text-primary" : "text-foreground-muted"
                )}
                style={{ fontSize: 15 }}
              >
                {tab.icon}
              </span>
              <span>{tab.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-0 fade-in">
      <FinancePrefetch />
      {children}
    </div>
  )
}
