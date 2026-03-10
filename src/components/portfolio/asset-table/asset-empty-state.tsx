"use client"

import Link from "next/link"

export function AssetTableEmptyState({
  overview,
  blockchainData,
  trackedAccounts,
  balancesError,
  overviewError,
  onRefresh,
  isRefreshing,
  refreshCooldown,
}: {
  overview?: any
  blockchainData?: any
  trackedAccounts?: any
  balancesError?: boolean
  overviewError?: any
  onRefresh?: () => void
  isRefreshing?: boolean
  refreshCooldown?: boolean
}) {
  const noApiKey =
    (overview as any)?.error === "no_api_key" ||
    (blockchainData as any)?.error === "no_api_key"

  const invalidApiKey =
    balancesError && (overviewError as any)?.message?.includes("Invalid Zerion API key")

  const hasTrackedWallets =
    ((overview as any)?.wallets?.length > 0) ||
    (blockchainData && Object.keys((blockchainData as any)?.per_account ?? {}).length > 0) ||
    (trackedAccounts &&
      typeof trackedAccounts === "object" &&
      Object.values(trackedAccounts as Record<string, unknown[]>).some(
        (arr) => Array.isArray(arr) && arr.length > 0,
      ))

  if (noApiKey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-rounded text-warning" style={{ fontSize: 48 }}>key</span>
        <div className="text-center">
          <p className="text-foreground-muted text-sm font-semibold">Zerion API Key Required</p>
          <p className="text-foreground-muted mt-1 text-xs">
            Add your Zerion API key in Portfolio Settings to load wallet data.
          </p>
        </div>
        <Link
          href="/portfolio/settings"
          className="btn-secondary text-xs tracking-wide"
          style={{ borderColor: "var(--warning)", color: "var(--warning)" }}
        >
          Configure API Key
        </Link>
      </div>
    )
  }

  if (invalidApiKey) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-rounded text-error" style={{ fontSize: 48 }}>key_off</span>
        <div className="text-center">
          <p className="text-foreground-muted text-sm font-semibold">Invalid Zerion API Key</p>
          <p className="text-foreground-muted mt-1 text-xs">
            Your Zerion API key was rejected. Update it in Portfolio Settings.
          </p>
        </div>
        <Link
          href="/portfolio/settings"
          className="btn-secondary text-xs tracking-wide"
          style={{ borderColor: "var(--error)", color: "var(--error)" }}
        >
          Update API Key
        </Link>
      </div>
    )
  }

  if (hasTrackedWallets) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 48 }}>account_balance_wallet</span>
        <div className="text-center">
          <p className="text-foreground-muted text-sm font-semibold">No assets detected</p>
          <p className="text-foreground-muted mt-1 text-xs">
            Your wallets are tracked but no assets were found. Try refreshing or verify that your
            wallets contain assets recognized by Zerion.
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={!!isRefreshing || refreshCooldown}
          className="btn-secondary text-xs tracking-wide"
        >
          Refresh Now
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 48 }}>account_balance_wallet</span>
      <div className="text-center">
        <p className="text-foreground-muted text-sm font-semibold">No wallets added</p>
        <p className="text-foreground-muted mt-1 text-xs">
          Add a wallet address to start tracking your portfolio.
        </p>
      </div>
      <Link href="/portfolio/accounts" className="btn-secondary text-xs tracking-wide">
        Add Wallet
      </Link>
    </div>
  )
}
