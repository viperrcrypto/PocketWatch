"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { TRACKER_NAV_TABS } from "@/lib/tracker/nav"

export function TrackerNav() {
  const pathname = usePathname()

  // Match the most specific tab: exact match or starts with tab href + "/"
  // Special case: "/tracker" only matches exactly (not all tracker/* routes)
  const activeTab = TRACKER_NAV_TABS.filter((tab) => {
    if (tab.href === "/tracker") return pathname === "/tracker"
    return pathname === tab.href || pathname.startsWith(tab.href + "/")
  }).sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <div className="border-b border-card-border -mx-1 overflow-x-auto scrollbar-hide">
      <nav className="flex items-center gap-0 min-w-max px-1" role="tablist">
        {TRACKER_NAV_TABS.map((tab) => {
          const isActive = activeTab?.href === tab.href

          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "flex items-center gap-2 px-4 py-3 transition-colors border-b-2 whitespace-nowrap",
                isActive
                  ? "text-foreground border-b-primary"
                  : "text-foreground-muted border-b-transparent hover:text-foreground"
              )}
            >
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 16 }}
              >
                {tab.icon}
              </span>
              <span
                className="text-[11px] font-medium uppercase tracking-wider"
              >
                {tab.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
