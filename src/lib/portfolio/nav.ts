// Centralized navigation constants for the portfolio tracker.
// All portfolio pages import from here instead of defining local tab arrays.

export const PORTFOLIO_NAV_TABS = [
  { label: "Dashboard", href: "/portfolio", icon: "dashboard" },
  { label: "Wallets", href: "/portfolio/accounts", icon: "wallet" },
  { label: "Balances", href: "/portfolio/balances", icon: "account_balance" },
  { label: "Activity", href: "/portfolio/history", icon: "history" },
  { label: "Settings", href: "/portfolio/settings", icon: "tune" },
]

export const BALANCE_SUB_TABS = [
  { label: "Blockchain", href: "/portfolio/balances" },
  { label: "Exchange", href: "/portfolio/balances/exchange" },
  { label: "Manual", href: "/portfolio/balances/manual" },
]

export const HISTORY_SUB_TABS = [
  { label: "Events", href: "/portfolio/history" },
  { label: "Exchange", href: "/portfolio/history/exchange" },
]

export const ACCOUNT_SUB_TABS = [
  { label: "Wallets", href: "/portfolio/accounts" },
]

// ============================================
// FINANCE (FIAT) NAVIGATION
// ============================================

// ============================================
// TRAVEL NAVIGATION
// ============================================

export const TRAVEL_NAV_TABS = [
  { label: "Flight Search", href: "/travel", icon: "flight" },
  { label: "Hotel Search", href: "/travel/hotels", icon: "hotel" },
  { label: "Settings", href: "/travel/settings", icon: "settings" },
]

export const FINANCE_NAV_TABS = [
  { label: "Dashboard",     href: "/finance",               icon: "monitoring" },
  { label: "Accounts",      href: "/finance/accounts",      icon: "account_balance" },
  { label: "Transactions",  href: "/finance/transactions",  icon: "receipt_long" },
  { label: "Budgets",       href: "/finance/budgets",       icon: "savings" },
  { label: "Cards & Bills", href: "/finance/cards",         icon: "credit_card" },
  { label: "Income",        href: "/finance/income",        icon: "payments" },
  { label: "Investments",   href: "/finance/investments",   icon: "show_chart" },
  { label: "Settings",      href: "/finance/settings",      icon: "settings" },
]
