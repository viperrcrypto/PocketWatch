"use client"

import { ChainIcon } from "@/components/portfolio/chain-icon"
import { SUPPORTED_CHAINS, EVM_CHAIN_IDS, getChainColor, hexToRgba } from "@/lib/portfolio/chains"

interface AddWalletDialogProps {
  newAddress: string
  newLabel: string
  selectedChains: Set<string>
  addError: string
  isPending: boolean
  onAddressChange: (val: string) => void
  onLabelChange: (val: string) => void
  onToggleChain: (chainId: string) => void
  onSetSelectedChains: (chains: Set<string>) => void
  onAdd: () => void
  onClose: () => void
}

export function AddWalletDialog({
  newAddress,
  newLabel,
  selectedChains,
  addError,
  isPending,
  onAddressChange,
  onLabelChange,
  onToggleChain,
  onSetSelectedChains,
  onAdd,
  onClose,
}: AddWalletDialogProps) {
  const trimmed = newAddress.trim()
  const isEvm = trimmed.startsWith("0x")
  const isBtc = /^(1|3|bc1)/i.test(trimmed)
  const isSolana = !isEvm && !isBtc && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-card-border w-full max-w-lg rounded-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
          <h2 className="text-foreground text-base font-semibold">
            Add Wallet
          </h2>
          <button
            onClick={onClose}
            className="text-foreground-muted hover:text-foreground transition-colors"
          >
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Address input */}
          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">
              Address
            </label>
            <input
              type="text"
              value={newAddress}
              onChange={(e) => onAddressChange(e.target.value)}
              placeholder="0x... or bc1... or Solana address"
              className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors font-data text-sm"
            />
            {addError && (
              <p className="mt-1 text-error text-xs font-data">{addError}</p>
            )}
            {trimmed.length > 0 && (
              <p className="mt-1.5 text-foreground-muted text-xs">
                {isEvm ? "EVM address detected — select chains to track" : isBtc ? "Bitcoin address detected" : isSolana ? "Solana address detected" : "Unrecognized address format"}
              </p>
            )}
          </div>

          {/* Name / Label (optional) */}
          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">
              Name <span className="font-normal text-foreground-muted/60">(optional)</span>
            </label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => onLabelChange(e.target.value)}
              placeholder="e.g. Cold Storage, Degen, Main..."
              className="w-full bg-transparent border-b border-card-border focus:border-foreground outline-none py-2 text-foreground placeholder-foreground-muted transition-colors text-sm"
            />
          </div>

          {/* Chain selector (multi-select) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-foreground-muted text-xs font-semibold">
                Chains ({selectedChains.size} selected)
              </label>
              {isEvm && (
                <button
                  onClick={() => {
                    const allEvmSelected = EVM_CHAIN_IDS.every((id) => selectedChains.has(id))
                    onSetSelectedChains(allEvmSelected ? new Set() : new Set(EVM_CHAIN_IDS))
                  }}
                  className="text-foreground-muted hover:text-foreground transition-colors text-xs"
                >
                  {EVM_CHAIN_IDS.every((id) => selectedChains.has(id)) ? "Deselect all" : "Select all EVM"}
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORTED_CHAINS.map((chain) => {
                const isSelected = selectedChains.has(chain.id)
                const isEvmChain = EVM_CHAIN_IDS.includes(chain.id)
                const dimmed = (isEvm && !isEvmChain) || (isBtc && chain.id !== "BTC") || (isSolana && chain.id !== "SOL")
                const chainColor = getChainColor(chain.id)

                return (
                  <button
                    key={chain.id}
                    onClick={() => onToggleChain(chain.id)}
                    disabled={dimmed}
                    className={`flex items-center gap-2 px-3 py-2 border transition-colors rounded-lg text-xs font-medium ${
                      isSelected
                        ? "text-foreground"
                        : dimmed
                          ? "border-card-border text-foreground-muted/30 cursor-not-allowed"
                          : "border-card-border text-foreground-muted hover:border-card-border-hover hover:text-foreground"
                    }`}
                    style={{
                      ...(isSelected ? {
                        borderColor: hexToRgba(chainColor, 0.5),
                        backgroundColor: hexToRgba(chainColor, 0.08),
                      } : {}),
                    }}
                  >
                    <span className={dimmed ? "opacity-20" : ""}>
                      <ChainIcon chainId={chain.id} size={14} />
                    </span>
                    {chain.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={onAdd}
              disabled={isPending}
              className="px-4 py-2 btn-primary transition-colors disabled:opacity-50 text-sm font-semibold"
            >
              {isPending
                ? `Adding to ${selectedChains.size} chain${selectedChains.size !== 1 ? "s" : ""}...`
                : `Add to ${selectedChains.size} Chain${selectedChains.size !== 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
