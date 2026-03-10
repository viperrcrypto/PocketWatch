"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { PORTFOLIO_NAV_TABS } from "@/lib/portfolio/nav"

interface PortfolioNavProps {
  /** Optional badge counts keyed by tab href (e.g. { "/portfolio/balances": 12 }) */
  badges?: Record<string, number>
}

export function PortfolioNav({ badges }: PortfolioNavProps = {}) {
  const pathname = usePathname()

  // Match the most specific tab: exact match or starts with tab href + "/"
  // Special case: "/portfolio" only matches exactly (not all portfolio/* routes)
  const activeTab = PORTFOLIO_NAV_TABS.filter((tab) => {
    if (tab.href === "/portfolio") return pathname === "/portfolio"
    return pathname === tab.href || pathname.startsWith(tab.href + "/")
  }).sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <div className="border-b border-card-border -mx-1 overflow-x-auto scrollbar-hide">
      <nav className="flex items-center gap-0 min-w-max px-1" role="tablist">
        {PORTFOLIO_NAV_TABS.map((tab) => {
          const isActive = activeTab?.href === tab.href
          const badgeCount = badges?.[tab.href]

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
              {badgeCount != null && badgeCount > 0 && (
                <span className="text-foreground-muted bg-background-secondary rounded-full font-data text-[9px] font-semibold px-1.5 py-0.5 leading-none tabular-nums">
                  {badgeCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
