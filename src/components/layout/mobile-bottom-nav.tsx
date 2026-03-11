"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { href: "/portfolio",           icon: "pie_chart",              label: "Overview" },
  { href: "/portfolio/balances",  icon: "account_balance_wallet", label: "Balances" },
  { href: "/portfolio/history",   icon: "history",                label: "History" },
  { href: "/portfolio/accounts",  icon: "wallet",                 label: "Wallets" },
]

interface MobileBottomNavProps {
  onMoreClick?: () => void
}

export function MobileBottomNav({ onMoreClick }: MobileBottomNavProps) {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-card-border flex items-center justify-around px-2 lg:hidden z-30"
      style={{ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/portfolio" && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors min-w-[56px]",
              isActive ? "text-primary" : "text-foreground-muted hover:text-foreground"
            )}
          >
            <span className={cn("material-symbols-rounded text-xl", isActive && "filled")} aria-hidden="true">
              {item.icon}
            </span>
            <span className="text-[10px] font-medium leading-none">{item.label}</span>
          </Link>
        )
      })}
      <button
        onClick={onMoreClick}
        aria-label="More navigation options"
        className="flex flex-col items-center gap-0.5 px-3 py-1.5 transition-colors text-foreground-muted hover:text-foreground min-w-[56px]"
      >
        <span className="material-symbols-rounded text-xl" aria-hidden="true">menu</span>
        <span className="text-[10px] font-medium leading-none">More</span>
      </button>
    </nav>
  )
}
