"use client"

import Link from "next/link"

const QUICK_ACTIONS = [
  { label: "Blockchain Balances", subtitle: "On-chain holdings", href: "/portfolio/balances", icon: "language" },
  { label: "Exchange Balances", subtitle: "CEX holdings", href: "/portfolio/balances/exchange", icon: "swap_horiz" },
  { label: "DeFi & LP", subtitle: "Yield & liquidity positions", href: "/portfolio/defi", icon: "account_tree" },
  { label: "Analytics", subtitle: "Cost basis & realized gains", href: "/portfolio/history/pnl", icon: "analytics" },
  { label: "Manual Balances", subtitle: "Cold storage & custom", href: "/portfolio/balances/manual", icon: "edit_note" },
] as const

export function QuickActionsGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {QUICK_ACTIONS.map((card) => (
        <Link
          key={card.href}
          href={card.href}
          className="flex items-center gap-5 px-5 py-5 bg-card border border-card-border hover:border-card-border-hover transition-all duration-300 group rounded-xl"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-background border border-card-border group-hover:border-card-border-hover flex-shrink-0 transition-colors rounded-lg">
            <span className="material-symbols-rounded text-xl text-foreground-muted group-hover:text-foreground transition-colors duration-300">
              {card.icon}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-foreground-secondary group-hover:text-foreground transition-colors text-sm font-semibold tracking-wide">
              {card.label}
            </p>
            <p className="text-foreground-muted mt-1 text-xs">
              {card.subtitle}
            </p>
          </div>
          <span className="material-symbols-rounded text-base text-foreground-muted group-hover:text-foreground group-hover:translate-x-1 ml-auto transition-all duration-300">
            arrow_forward
          </span>
        </Link>
      ))}
    </div>
  )
}
