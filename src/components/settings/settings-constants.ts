export const SETTINGS_TABS = [
  { id: "general", label: "General", icon: "tune" },
  { id: "finance", label: "Finance", icon: "account_balance" },
  { id: "digital-assets", label: "Digital Assets", icon: "pie_chart" },
  { id: "travel", label: "Travel", icon: "flight" },
] as const

export type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"]

export const SETTINGS_SECTIONS = [
  { tab: "general", id: "preferences", title: "Preferences", keywords: ["currency", "theme", "dark mode", "light mode", "sync", "background"] },
  { tab: "general", id: "auto-lock", title: "Auto-Lock", keywords: ["inactivity", "lock", "timeout", "security"] },
  { tab: "general", id: "password", title: "Password", keywords: ["change password", "vault", "security"] },
  { tab: "general", id: "passkeys", title: "Passkeys", keywords: ["biometrics", "security key", "webauthn", "fingerprint"] },
  { tab: "general", id: "notification-channels", title: "Notification Channels", keywords: ["push", "email", "alerts", "notifications"] },
  { tab: "general", id: "notification-routing", title: "Notification Routing", keywords: ["severity", "categories", "quiet hours", "routing"] },
  { tab: "general", id: "backup", title: "Backup & Restore", keywords: ["export", "import", "vault", "encrypted", "backup"] },
  { tab: "general", id: "data-management", title: "Data Management", keywords: ["clear", "reset", "delete", "data"] },
  { tab: "finance", id: "bank-connections", title: "Bank Connections", keywords: ["plaid", "simplefin", "bank", "institution", "connect"] },
  { tab: "finance", id: "upload-statements", title: "Upload Statements", keywords: ["csv", "ofx", "bank statement", "import", "upload"] },
  { tab: "finance", id: "sync-status", title: "Sync Status", keywords: ["plaid", "refresh", "sync", "institution"] },
  { tab: "finance", id: "data-coverage", title: "Data Coverage", keywords: ["coverage", "year", "months", "chart"] },
  { tab: "finance", id: "ai-intelligence", title: "AI Intelligence", keywords: ["ai", "provider", "model", "openai", "anthropic", "intelligence"] },
  { tab: "digital-assets", id: "sync-diagnostics", title: "Sync Diagnostics", keywords: ["sync", "history", "transactions", "diagnostics"] },
  { tab: "digital-assets", id: "api-keys", title: "API Keys", keywords: ["zerion", "alchemy", "helius", "etherscan", "codex", "key", "provider"] },
  { tab: "digital-assets", id: "exchange-connections", title: "Exchange Connections", keywords: ["kraken", "coinbase", "exchange", "connect"] },
  { tab: "digital-assets", id: "data-management-portfolio", title: "Data Management", keywords: ["clear", "reset", "portfolio", "data"] },
  { tab: "travel", id: "travel-credentials", title: "Travel Credentials", keywords: ["roame", "serpapi", "atf", "point.me", "flight", "search", "token"] },
] as const

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]
