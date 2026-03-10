"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface Tab {
  label: string
  href: string
}

interface PortfolioSubNavProps {
  tabs: Tab[]
}

export function PortfolioSubNav({ tabs }: PortfolioSubNavProps) {
  const pathname = usePathname()

  // Find the most specific matching tab (longest href that matches)
  const bestMatch = tabs
    .filter((t) => pathname === t.href || pathname.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <div className="border-b border-card-border mb-6 -mx-1 overflow-x-auto scrollbar-hide">
      <nav className="flex items-center gap-0 min-w-max px-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = bestMatch ? tab.href === bestMatch.href : pathname === tab.href

          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "px-4 py-3 text-sm transition-colors border-b-2 whitespace-nowrap",
                isActive
                  ? "text-primary border-b-primary font-medium"
                  : "text-foreground-muted border-b-transparent hover:text-foreground"
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
