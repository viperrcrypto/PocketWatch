"use client"

import { useState, useCallback } from "react"
import {
  useTrackerWallets,
  useUpdateTrackerWallet,
  useRemoveTrackerWallet,
  useScanWallet,
} from "@/hooks/use-tracker"
import WalletList from "@/components/tracker/wallets/wallet-list"
import AddWalletDialog from "@/components/tracker/wallets/add-wallet-dialog"
import type { TrackerWalletData } from "@/lib/tracker/types"

export default function TrackerWalletsPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [scanning, setScanning] = useState<string | null>(null)

  const { data, isLoading } = useTrackerWallets()
  const updateWallet = useUpdateTrackerWallet()
  const removeWallet = useRemoveTrackerWallet()
  const scanWallet = useScanWallet()

  const wallets = data?.wallets ?? []

  const handleEdit = useCallback((_wallet: TrackerWalletData) => {
    // For now just toggle — can expand to a dialog later
  }, [])

  const handleDelete = useCallback(
    (walletId: string) => {
      if (confirm("Remove this wallet? Transaction history will be deleted.")) {
        removeWallet.mutate(walletId)
      }
    },
    [removeWallet]
  )

  const handleToggleActive = useCallback(
    (walletId: string, isActive: boolean) => {
      updateWallet.mutate({ id: walletId, isActive })
    },
    [updateWallet]
  )

  const handleScan = useCallback(
    async (walletId: string) => {
      setScanning(walletId)
      try {
        await scanWallet.mutateAsync(walletId)
      } catch {
        // Error handled by React Query
      } finally {
        setScanning(null)
      }
    },
    [scanWallet]
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Tracked Wallets</h1>
          <p className="text-sm text-foreground-muted mt-0.5">
            Monitor on-chain activity across EVM and Solana
          </p>
        </div>
        <div className="flex items-center gap-2">
          {wallets.length > 0 && (
            <button
              onClick={() => {
                // Scan all active wallets
                wallets
                  .filter((w) => w.isActive)
                  .forEach((w) => handleScan(w.id))
              }}
              className="btn-secondary"
              disabled={!!scanning}
            >
              {scanning ? (
                <>
                  <span className="loading-spinner mr-2" />
                  Scanning...
                </>
              ) : (
                <>
                  <span className="material-symbols-rounded mr-1.5" style={{ fontSize: 16 }}>
                    radar
                  </span>
                  Scan All
                </>
              )}
            </button>
          )}
          <button onClick={() => setShowAdd(true)} className="btn-primary">
            <span className="material-symbols-rounded mr-1.5" style={{ fontSize: 16 }}>
              add
            </span>
            Add Wallet
          </button>
        </div>
      </div>

      {/* Wallet list */}
      {isLoading ? (
        <div className="card p-8 flex items-center justify-center">
          <span className="loading-spinner mr-2" />
          <span className="text-sm text-foreground-muted">Loading wallets...</span>
        </div>
      ) : (
        <>
          <WalletList
            wallets={wallets}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggleActive={handleToggleActive}
          />

          {/* Per-wallet scan buttons */}
          {wallets.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {wallets.map((w) => (
                <div key={w.id} className="card p-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {w.emoji ? `${w.emoji} ` : ""}{w.label || w.address.slice(0, 10)}
                    </p>
                    <p className="text-xs text-foreground-muted font-mono">
                      {w.lastScannedAt
                        ? `Last scan: ${new Date(w.lastScannedAt).toLocaleString()}`
                        : "Never scanned"}
                    </p>
                    {w.txCount !== undefined && (
                      <p className="text-xs text-foreground-muted">
                        {w.txCount} transactions tracked
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleScan(w.id)}
                    className="btn-secondary text-xs h-8 px-3"
                    disabled={scanning === w.id}
                  >
                    {scanning === w.id ? (
                      <span className="loading-spinner" />
                    ) : (
                      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>
                        radar
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Add wallet dialog */}
      <AddWalletDialog open={showAdd} onOpenChange={setShowAdd} />
    </div>
  )
}
