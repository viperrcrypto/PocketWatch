"use client"

import { useState, useEffect, useCallback } from "react"

export interface NavItem {
  id: string
  label: string
  href: string
  icon: string
}

export interface CategoryPrefs {
  order: string[]
  hidden: string[]
}

export interface SidebarPrefs {
  categoryOrder: string[]
  categories: Record<string, CategoryPrefs>
}

const STORAGE_KEY = "pw-sidebar-prefs"

export const PORTFOLIO_NAV_ITEMS: NavItem[] = [
  { id: "portfolio",    label: "Overview",      href: "/portfolio",              icon: "pie_chart" },
  { id: "balances",     label: "Balances",      href: "/portfolio/balances",     icon: "account_balance_wallet" },
  { id: "history",      label: "Activity",      href: "/portfolio/history",      icon: "history" },
  { id: "accounts",     label: "Wallets",       href: "/portfolio/accounts",     icon: "wallet" },
  { id: "staking",      label: "Staking",       href: "/portfolio/staking",      icon: "layers" },
]

export const FINANCE_NAV_ITEMS: NavItem[] = [
  { id: "fin-dashboard",     label: "Dashboard",      href: "/finance",                icon: "monitoring" },
  { id: "fin-insights",      label: "Insights",       href: "/finance/insights",       icon: "analytics" },
  { id: "fin-accounts",      label: "Accounts",       href: "/finance/accounts",       icon: "account_balance" },
  { id: "fin-transactions",  label: "Transactions",   href: "/finance/transactions",   icon: "receipt_long" },
  { id: "fin-budgets",       label: "Budgets",        href: "/finance/budgets",        icon: "savings" },
  { id: "fin-investments",   label: "Investments",    href: "/finance/investments",    icon: "show_chart" },
  { id: "fin-cards",         label: "Cards & Bills",  href: "/finance/cards",          icon: "credit_card" },
]

export const NET_WORTH_NAV_ITEMS: NavItem[] = [
  { id: "net-worth", label: "Net Worth", href: "/net-worth", icon: "equalizer" },
]

export const TRAVEL_NAV_ITEMS: NavItem[] = [
  { id: "travel-flights", label: "Flight Search", href: "/travel", icon: "flight" },
  { id: "travel-hotels", label: "Hotel Search", href: "/travel/hotels", icon: "hotel" },
]

export const AI_NAV_ITEMS: NavItem[] = [
  { id: "ai-chat", label: "PocketLLM", href: "/chat", icon: "smart_toy" },
]

export const NAV_CATEGORIES: Record<string, { label: string; items: NavItem[] }> = {
  netWorth:  { label: "",              items: NET_WORTH_NAV_ITEMS },
  finance:   { label: "Finance",       items: FINANCE_NAV_ITEMS },
  portfolio: { label: "Digital Assets", items: PORTFOLIO_NAV_ITEMS },
  travel:    { label: "Travel",        items: TRAVEL_NAV_ITEMS },
}

function buildDefaultPrefs(): SidebarPrefs {
  return {
    categoryOrder: ["netWorth", "finance", "portfolio", "travel"],
    categories: {
      netWorth:  { order: NET_WORTH_NAV_ITEMS.map((i) => i.id), hidden: [] },
      finance:   { order: FINANCE_NAV_ITEMS.map((i) => i.id),   hidden: [] },
      portfolio: { order: PORTFOLIO_NAV_ITEMS.map((i) => i.id), hidden: [] },
      travel:    { order: TRAVEL_NAV_ITEMS.map((i) => i.id),    hidden: [] },
    },
  }
}

function migratePrefs(prefs: SidebarPrefs): SidebarPrefs {
  // Inject netWorth category if missing (added after initial release)
  if (!prefs.categoryOrder.includes("netWorth")) {
    prefs.categoryOrder.unshift("netWorth")
    prefs.categories.netWorth = {
      order: NET_WORTH_NAV_ITEMS.map((i) => i.id),
      hidden: [],
    }
    savePrefs(prefs)
  }
  // Inject travel category if missing
  if (!prefs.categoryOrder.includes("travel")) {
    const finIdx = prefs.categoryOrder.indexOf("finance")
    prefs.categoryOrder.splice(finIdx + 1, 0, "travel")
    prefs.categories.travel = {
      order: TRAVEL_NAV_ITEMS.map((i) => i.id),
      hidden: [],
    }
    savePrefs(prefs)
  }
  // Inject travel-hotels item if missing (added in Phase 2)
  const travelCat = prefs.categories.travel
  if (travelCat && !travelCat.order.includes("travel-hotels")) {
    const settingsIdx = travelCat.order.indexOf("travel-settings")
    if (settingsIdx >= 0) {
      travelCat.order.splice(settingsIdx, 0, "travel-hotels")
    } else {
      travelCat.order.push("travel-hotels")
    }
    savePrefs(prefs)
  }
  // Remove ai category (PocketLLM moved to floating button only)
  if (prefs.categoryOrder.includes("ai")) {
    prefs.categoryOrder = prefs.categoryOrder.filter((c) => c !== "ai")
    delete prefs.categories.ai
    savePrefs(prefs)
  }
  // Remove domain settings items (consolidated to /settings)
  const staleSettingsIds = ["settings", "fin-settings", "travel-settings"]
  let settingsRemoved = false
  for (const catKey of ["portfolio", "finance", "travel"]) {
    const cat = prefs.categories[catKey]
    if (!cat) continue
    if (cat.order.some((id) => staleSettingsIds.includes(id))) {
      cat.order = cat.order.filter((id) => !staleSettingsIds.includes(id))
      cat.hidden = cat.hidden.filter((id) => !staleSettingsIds.includes(id))
      settingsRemoved = true
    }
  }
  if (settingsRemoved) savePrefs(prefs)
  return prefs
}

function loadPrefs(): SidebarPrefs {
  if (typeof window === "undefined") return buildDefaultPrefs()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return buildDefaultPrefs()
    const parsed = JSON.parse(raw) as SidebarPrefs
    if (!parsed.categoryOrder || !parsed.categories) return buildDefaultPrefs()
    return migratePrefs(parsed)
  } catch {
    return buildDefaultPrefs()
  }
}

function savePrefs(prefs: SidebarPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // quota exceeded — ignore
  }
}

/** Returns visible items in user-defined order, appending any new items not yet in prefs */
export function getOrderedItems(categoryKey: string, prefs: SidebarPrefs): NavItem[] {
  const defaults = NAV_CATEGORIES[categoryKey]?.items ?? []
  const catPrefs = prefs.categories[categoryKey]
  if (!catPrefs) return defaults

  const hiddenSet = new Set(catPrefs.hidden)
  const itemMap = new Map(defaults.map((i) => [i.id, i]))

  // Items in stored order (skip removed ones)
  const ordered: NavItem[] = []
  for (const id of catPrefs.order) {
    const item = itemMap.get(id)
    if (item && !hiddenSet.has(id)) ordered.push(item)
    itemMap.delete(id)
  }
  // Append any new items not in stored order
  for (const item of itemMap.values()) {
    if (!hiddenSet.has(item.id)) ordered.push(item)
  }
  return ordered
}

/** Returns ALL items in order (including hidden) for the edit UI */
export function getAllItemsOrdered(categoryKey: string, prefs: SidebarPrefs): NavItem[] {
  const defaults = NAV_CATEGORIES[categoryKey]?.items ?? []
  const catPrefs = prefs.categories[categoryKey]
  if (!catPrefs) return defaults

  const itemMap = new Map(defaults.map((i) => [i.id, i]))
  const ordered: NavItem[] = []
  for (const id of catPrefs.order) {
    const item = itemMap.get(id)
    if (item) ordered.push(item)
    itemMap.delete(id)
  }
  for (const item of itemMap.values()) {
    ordered.push(item)
  }
  return ordered
}

export function useSidebarPrefs() {
  const [prefs, setPrefs] = useState<SidebarPrefs>(buildDefaultPrefs)
  const [isEditing, setIsEditing] = useState(false)

  useEffect(() => {
    setPrefs(loadPrefs())
  }, [])

  const update = useCallback((updater: (prev: SidebarPrefs) => SidebarPrefs) => {
    setPrefs((prev) => {
      const next = updater(prev)
      savePrefs(next)
      return next
    })
  }, [])

  const moveItem = useCallback((categoryKey: string, itemId: string, direction: "up" | "down") => {
    update((prev) => {
      const cat = prev.categories[categoryKey]
      if (!cat) return prev
      const order = [...cat.order]
      const idx = order.indexOf(itemId)
      if (idx < 0) return prev
      const swapIdx = direction === "up" ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= order.length) return prev
      ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]
      return {
        ...prev,
        categories: { ...prev.categories, [categoryKey]: { ...cat, order } },
      }
    })
  }, [update])

  const toggleVisibility = useCallback((categoryKey: string, itemId: string) => {
    update((prev) => {
      const cat = prev.categories[categoryKey]
      if (!cat) return prev
      const hidden = cat.hidden.includes(itemId)
        ? cat.hidden.filter((id) => id !== itemId)
        : [...cat.hidden, itemId]
      return {
        ...prev,
        categories: { ...prev.categories, [categoryKey]: { ...cat, hidden } },
      }
    })
  }, [update])

  const moveCategory = useCallback((categoryKey: string, direction: "up" | "down") => {
    update((prev) => {
      const order = [...prev.categoryOrder]
      const idx = order.indexOf(categoryKey)
      if (idx < 0) return prev
      const swapIdx = direction === "up" ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= order.length) return prev
      ;[order[idx], order[swapIdx]] = [order[swapIdx], order[idx]]
      return { ...prev, categoryOrder: order }
    })
  }, [update])

  const resetToDefaults = useCallback(() => {
    const defaults = buildDefaultPrefs()
    setPrefs(defaults)
    savePrefs(defaults)
  }, [])

  return {
    prefs,
    isEditing,
    setIsEditing,
    moveItem,
    toggleVisibility,
    moveCategory,
    resetToDefaults,
  }
}
