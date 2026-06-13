"use client"

import { useEffect, useState, useMemo } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { Command } from "cmdk"
import { useFinanceAccounts, useCreditCards, useFinanceSubscriptions, useFinanceTransactions } from "@/hooks/use-finance"
import { useTrips } from "@/hooks/use-trips"
import {
  NET_WORTH_NAV_ITEMS, FINANCE_NAV_ITEMS, PORTFOLIO_NAV_ITEMS, TRAVEL_NAV_ITEMS, AI_NAV_ITEMS,
} from "@/hooks/use-sidebar-prefs"
import { usePrivacyMode } from "@/hooks/use-privacy-mode"
import { BlurredValue } from "@/components/portfolio/blurred-value"
import { formatCurrency } from "@/lib/utils"

const PAGES = [
  ...NET_WORTH_NAV_ITEMS, ...FINANCE_NAV_ITEMS, ...PORTFOLIO_NAV_ITEMS, ...TRAVEL_NAV_ITEMS, ...AI_NAV_ITEMS,
]

const QUICK_ACTIONS = [
  { label: "Connect an account", icon: "add_link", href: "/finance/accounts" },
  { label: "Add a manual investment", icon: "add", href: "/finance/investments" },
  { label: "Categorize transactions", icon: "rate_review", href: "/finance/categorize?mode=rebuild" },
  { label: "Settings", icon: "settings", href: "/settings" },
]

/**
 * Notion/Telegram-style global search. Cmd/Ctrl+K opens it from anywhere; jumps
 * to pages and your real entities (accounts, cards, trips, subscriptions, and
 * searched transactions). Mounted once in the dashboard shell.
 */
export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && !e.repeat && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [])

  if (typeof document === "undefined" || !open) return null
  // Render the data-fetching content only while open, so the entity queries
  // don't fire app-wide on every page.
  return createPortal(<Palette onClose={() => setOpen(false)} />, document.body)
}

const itemClass =
  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-foreground cursor-pointer select-none data-[selected=true]:bg-background-secondary"
const iconClass = "material-symbols-rounded text-foreground-muted flex-shrink-0"
const groupClass =
  "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-foreground-muted"

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const { isHidden } = usePrivacyMode()

  // Debounce the transaction search so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query.trim()), 200)
    return () => clearTimeout(id)
  }, [query])

  const { data: institutions } = useFinanceAccounts()
  const { data: cards } = useCreditCards()
  const { data: trips } = useTrips()
  const { data: subsData } = useFinanceSubscriptions()
  const txQuery = debouncedQuery.length >= 2 ? debouncedQuery : undefined
  const { data: txData } = useFinanceTransactions({ page: 1, limit: 6, search: txQuery }, { enabled: !!txQuery })

  const accounts = useMemo(
    () => (institutions ?? [])
      .flatMap((i) => i.accounts.map((a) => ({ ...a, institutionName: i.institutionName })))
      .filter((a) => !a.isHidden),
    [institutions],
  )
  const subscriptions = subsData?.subscriptions ?? []
  const transactions = txQuery ? (txData?.transactions ?? []) : []

  const go = (href: string) => { onClose(); router.push(href) }

  // Lock body scroll + close on Escape (stopPropagation so it doesn't also close
  // a sheet/modal underneath).
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose() }
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh] bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global search"
    >
      <div
        className="w-full max-w-xl bg-card border border-card-border rounded-2xl overflow-hidden"
        style={{ boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Command label="Global search" shouldFilter className="flex flex-col max-h-[70dvh]">
          <div className="flex items-center gap-2 px-4 border-b border-card-border">
            <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>search</span>
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, accounts, transactions…"
              className="flex-1 bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-foreground-muted"
            />
            <kbd className="text-[10px] text-foreground-muted border border-card-border rounded px-1.5 py-0.5">esc</kbd>
          </div>

          <Command.List className="overflow-y-auto p-2">
            <Command.Empty className="px-3 py-6 text-center text-sm text-foreground-muted">
              No results
            </Command.Empty>

            <Command.Group heading="Pages" className={groupClass}>
              {PAGES.map((p) => (
                <Command.Item key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)} className={itemClass}>
                  <span className={iconClass} style={{ fontSize: 18 }}>{p.icon}</span>
                  {p.label}
                </Command.Item>
              ))}
            </Command.Group>

            {accounts.length > 0 && (
              <Command.Group heading="Accounts" className={groupClass}>
                {accounts.map((a) => (
                  <Command.Item key={a.id} value={`account ${a.name} ${a.institutionName} ${a.mask ?? ""} ${a.id}`} onSelect={() => go(`/finance/accounts/${a.id}`)} className={itemClass}>
                    <span className={iconClass} style={{ fontSize: 18 }}>account_balance</span>
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="text-xs text-foreground-muted tabular-nums">
                      <BlurredValue isHidden={isHidden}>{formatCurrency(a.currentBalance ?? 0)}</BlurredValue>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {(cards?.length ?? 0) > 0 && (
              <Command.Group heading="Cards" className={groupClass}>
                {(cards ?? []).map((c) => (
                  <Command.Item key={c.id} value={`card ${c.cardName}`} onSelect={() => go(`/finance/cards/${c.id}`)} className={itemClass}>
                    <span className={iconClass} style={{ fontSize: 18 }}>credit_card</span>
                    <span className="flex-1 truncate">{c.cardName}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {(trips?.length ?? 0) > 0 && (
              <Command.Group heading="Trips" className={groupClass}>
                {(trips ?? []).map((t) => (
                  <Command.Item key={t.id} value={`trip ${t.name} ${t.destination ?? ""}`} onSelect={() => go(`/trips/${t.id}`)} className={itemClass}>
                    <span className={iconClass} style={{ fontSize: 18 }}>luggage</span>
                    <span className="flex-1 truncate">{t.name}</span>
                    {t.destination && <span className="text-xs text-foreground-muted truncate">{t.destination}</span>}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {subscriptions.length > 0 && (
              <Command.Group heading="Subscriptions" className={groupClass}>
                {subscriptions.map((s) => (
                  <Command.Item key={s.id} value={`subscription ${s.merchantName}`} onSelect={() => go("/finance/subscriptions")} className={itemClass}>
                    <span className={iconClass} style={{ fontSize: 18 }}>subscriptions</span>
                    <span className="flex-1 truncate">{s.merchantName}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {transactions.length > 0 && (
              <Command.Group heading="Transactions" className={groupClass}>
                {transactions.map((t) => (
                  <Command.Item key={t.id} value={`tx ${t.merchantName ?? ""} ${query}`} onSelect={() => go(`/finance/transactions?search=${encodeURIComponent(t.merchantName ?? "")}`)} className={itemClass}>
                    <span className={iconClass} style={{ fontSize: 18 }}>receipt_long</span>
                    <span className="flex-1 truncate">{t.merchantName ?? "Transaction"}</span>
                    <span className="text-xs text-foreground-muted tabular-nums">
                      <BlurredValue isHidden={isHidden}>{formatCurrency(t.amount)}</BlurredValue>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group heading="Actions" className={groupClass}>
              {QUICK_ACTIONS.map((a) => (
                <Command.Item key={a.label} value={`action ${a.label}`} onSelect={() => go(a.href)} className={itemClass}>
                  <span className={iconClass} style={{ fontSize: 18 }}>{a.icon}</span>
                  {a.label}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  )
}
