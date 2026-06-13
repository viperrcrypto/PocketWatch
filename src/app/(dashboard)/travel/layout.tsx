"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { indicatorSpring } from "@/lib/motion-transitions"
import { cn } from "@/lib/utils"
import { TRAVEL_NAV_TABS } from "@/lib/portfolio/nav"

function TravelNav() {
  const pathname = usePathname()
  const reduce = useReducedMotion()

  const activeTab = TRAVEL_NAV_TABS.filter((tab) => {
    if (tab.href === "/travel") return pathname === "/travel"
    return pathname === tab.href || pathname.startsWith(tab.href + "/")
  }).sort((a, b) => b.href.length - a.href.length)[0]

  return (
    <div className="border-b border-card-border -mx-1 overflow-x-auto scrollbar-hide">
      <nav className="flex items-center gap-0 min-w-max px-1" role="tablist">
        {TRAVEL_NAV_TABS.map((tab) => {
          const isActive = activeTab?.href === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "relative flex items-center gap-2 px-4 py-3 transition-colors duration-200 border-b-2 whitespace-nowrap text-sm",
                isActive
                  ? "text-primary border-b-transparent font-medium"
                  : "text-foreground-muted border-b-transparent hover:text-foreground"
              )}
            >
              {isActive && (
                <motion.span
                  layoutId="travel-nav-underline"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-primary rounded-full"
                  transition={reduce ? { duration: 0 } : indicatorSpring}
                />
              )}
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

export default function TravelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-0 fade-in">
      <TravelNav />
      {children}
    </div>
  )
}
