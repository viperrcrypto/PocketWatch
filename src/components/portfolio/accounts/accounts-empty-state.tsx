"use client"

import Link from "next/link"

interface AccountsEmptyStateProps {
  onAddWallet: () => void
}

export function AccountsEmptyState({ onAddWallet }: AccountsEmptyStateProps) {
  return (
    <div className="bg-card border border-card-border py-16 text-center rounded-xl">
      <span className="material-symbols-rounded block mb-4 text-foreground-muted" style={{ fontSize: 48 }}>
        account_balance_wallet
      </span>
      <p className="text-foreground-muted mb-4 text-xs">
        No wallets tracked yet
      </p>
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={onAddWallet}
          className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm"
        >
          Add Wallet
        </button>
        <Link
          href="/portfolio/settings"
          className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm"
        >
          Connect Exchange
        </Link>
      </div>
    </div>
  )
}
