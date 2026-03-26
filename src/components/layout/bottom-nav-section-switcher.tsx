"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { SECTION_TABS, getActiveSection } from "./nav-constants"

export function BottomNavSectionSwitcher() {
  const pathname = usePathname()
  const activeSection = getActiveSection(pathname)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 h-16 border-t border-glass-border flex items-center justify-around px-1 md:hidden z-30 safe-area-bottom"
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
      }}
    >
      {SECTION_TABS.map((tab) => {
        const isActive = activeSection === tab.key
        return (
          <Link
            key={tab.key}
            href={tab.root}
            className={cn(
              "mobile-nav-pill",
              isActive && "active",
              isActive ? "text-primary" : "text-foreground-muted",
            )}
          >
            <div className="mobile-nav-icon-wrap">
              <span
                className={cn(
                  "material-symbols-rounded icon-xl",
                  isActive && "filled",
                )}
                aria-hidden="true"
              >
                {tab.icon}
              </span>
            </div>
            <span className="text-[10px] font-medium leading-none">
              {tab.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
