"use client"

import type { TrackerWalletData } from "@/lib/tracker/types"
import { CHAIN_CONFIGS } from "@/lib/tracker/chains"
import { truncateAddress } from "@/lib/tracker/links"
import { getRelativeTime } from "@/lib/tracker/classifier"

interface WalletListProps {
  wallets: TrackerWalletData[]
  onEdit: (wallet: TrackerWalletData) => void
  onDelete: (walletId: string) => void
  onToggleActive?: (walletId: string, isActive: boolean) => void
}

export default function WalletList({
  wallets,
  onEdit,
  onDelete,
  onToggleActive,
}: WalletListProps) {
  if (wallets.length === 0) {
    return (
      <div className="card p-12 flex flex-col items-center justify-center text-center space-y-3">
        <span
          className="material-symbols-rounded text-card-border"
          style={{ fontSize: 48 }}
        >
          account_balance_wallet
        </span>
        <h3 className="text-lg text-foreground">No wallets tracked</h3>
        <p className="text-sm text-foreground-muted max-w-sm">
          Add a wallet address to start tracking its on-chain activity across
          EVM and Solana chains.
        </p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-card-border bg-background-secondary">
            <th className="text-left px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Label
            </th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Address
            </th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Chain
            </th>
            <th className="text-left px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Last Active
            </th>
            <th className="text-center px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Status
            </th>
            <th className="text-right px-4 py-3 text-[10px] font-mono font-medium text-foreground-muted uppercase tracking-widest">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {wallets.map((wallet) => {
            const chainConfig = CHAIN_CONFIGS[wallet.chain]
            return (
              <tr
                key={wallet.id}
                className="border-b border-card-border last:border-b-0 table-row-hover transition-colors"
              >
                {/* Label */}
                <td className="px-4 py-3">
                  <span className="text-sm text-foreground font-medium">
                    {wallet.label || "Unlabeled"}
                  </span>
                </td>

                {/* Address */}
                <td className="px-4 py-3">
                  <span className="text-sm text-foreground-muted font-mono tabular-nums">
                    {truncateAddress(wallet.address)}
                  </span>
                </td>

                {/* Chain */}
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider border"
                    style={{
                      borderColor: chainConfig.color,
                      color: chainConfig.color,
                      backgroundColor: `${chainConfig.color}15`,
                      borderRadius: 0,
                    }}
                  >
                    {chainConfig.shortName}
                  </span>
                </td>

                {/* Last Active */}
                <td className="px-4 py-3">
                  <span className="text-xs text-foreground-muted font-mono tabular-nums">
                    {wallet.lastTxAt ? getRelativeTime(wallet.lastTxAt) : "Never"}
                  </span>
                </td>

                {/* Status Toggle */}
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onToggleActive?.(wallet.id, !wallet.isActive)}
                    className="admin-toggle mx-auto"
                    data-state={wallet.isActive ? "on" : "off"}
                    title={wallet.isActive ? "Active - click to pause" : "Paused - click to activate"}
                  >
                    <span className="admin-toggle-thumb" />
                  </button>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onEdit(wallet)}
                      className="btn-ghost h-8 w-8 p-0 flex items-center justify-center"
                      title="Edit wallet"
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                        edit
                      </span>
                    </button>
                    <button
                      onClick={() => onDelete(wallet.id)}
                      className="btn-ghost h-8 w-8 p-0 flex items-center justify-center text-error hover:text-error"
                      title="Remove wallet"
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
                        delete
                      </span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
