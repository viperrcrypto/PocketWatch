// Centralized navigation constants for the wallet tracker.
// All tracker pages import from here instead of defining local tab arrays.

export const TRACKER_NAV_TABS = [
  { label: "Feed", href: "/tracker", icon: "rss_feed" },
  { label: "Wallets", href: "/tracker/wallets", icon: "account_balance_wallet" },
  { label: "Analytics", href: "/tracker/analytics", icon: "analytics" },
  { label: "Alerts", href: "/tracker/alerts", icon: "notifications" },
  { label: "Settings", href: "/tracker/settings", icon: "tune" },
]
