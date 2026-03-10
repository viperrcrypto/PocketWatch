"use client"

import { shortenAddress } from "@/lib/portfolio/utils"

interface FilterBarProps {
  wallets: Array<{ address: string; label?: string | null }>
  assets: string[]
  selectedWallets: string[]
  selectedAssets: string[]
  onWalletsChange: (wallets: string[]) => void
  onAssetsChange: (assets: string[]) => void
}

export function PnlFilterBar({
  wallets,
  assets,
  selectedWallets,
  selectedAssets,
  onWalletsChange,
  onAssetsChange,
}: FilterBarProps) {
  const toggleWallet = (addr: string) => {
    onWalletsChange(
      selectedWallets.includes(addr)
        ? selectedWallets.filter((w) => w !== addr)
        : [...selectedWallets, addr]
    )
  }

  const toggleAsset = (asset: string) => {
    onAssetsChange(
      selectedAssets.includes(asset)
        ? selectedAssets.filter((a) => a !== asset)
        : [...selectedAssets, asset]
    )
  }

  if (wallets.length === 0 && assets.length === 0) return null

  return (
    <div className="bg-card border border-card-border p-4 rounded-xl mb-4">
      <div className="flex flex-wrap gap-6">
        {/* Wallet chips */}
        {wallets.length > 1 && (
          <div>
            <p className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2">WALLETS</p>
            <div className="flex flex-wrap gap-1.5">
              {wallets.map((w) => {
                const isSelected = selectedWallets.length === 0 || selectedWallets.includes(w.address)
                return (
                  <button
                    key={w.address}
                    onClick={() => toggleWallet(w.address)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-data transition-colors ${
                      isSelected
                        ? "bg-foreground/10 text-foreground border border-foreground/20"
                        : "bg-card-border/30 text-foreground-muted border border-transparent hover:border-card-border-hover"
                    }`}
                  >
                    {w.label || shortenAddress(w.address, 4)}
                  </button>
                )
              })}
              {selectedWallets.length > 0 && (
                <button
                  onClick={() => onWalletsChange([])}
                  className="px-2 py-1 text-foreground-muted hover:text-foreground text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {/* Asset chips */}
        {assets.length > 1 && (
          <div>
            <p className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2">ASSETS</p>
            <div className="flex flex-wrap gap-1.5">
              {assets.slice(0, 20).map((a) => {
                const isSelected = selectedAssets.length === 0 || selectedAssets.includes(a)
                return (
                  <button
                    key={a}
                    onClick={() => toggleAsset(a)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-data transition-colors ${
                      isSelected
                        ? "bg-foreground/10 text-foreground border border-foreground/20"
                        : "bg-card-border/30 text-foreground-muted border border-transparent hover:border-card-border-hover"
                    }`}
                  >
                    {a}
                  </button>
                )
              })}
              {selectedAssets.length > 0 && (
                <button
                  onClick={() => onAssetsChange([])}
                  className="px-2 py-1 text-foreground-muted hover:text-foreground text-xs"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
