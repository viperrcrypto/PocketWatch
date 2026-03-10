"use client"

import { useState } from "react"
import { useAddAccount } from "@/hooks/use-portfolio-tracker"
import { SUPPORTED_CHAINS, EVM_CHAIN_IDS, getChainColor, hexToRgba } from "@/lib/portfolio/chains"
import { ChainIcon } from "@/components/portfolio/chain-icon"

export function StepAddWallet({ onNext }: { onNext: () => void }) {
  const [selectedChains, setSelectedChains] = useState<Set<string>>(
    new Set(EVM_CHAIN_IDS)
  )
  const [address, setAddress] = useState("")
  const addAccount = useAddAccount()

  const isEvm = address.trim().startsWith("0x")
  const isBtc = /^(1|3|bc1)/i.test(address.trim())

  const toggleChain = (chainId: string) => {
    setSelectedChains((prev) => {
      const next = new Set(prev)
      if (next.has(chainId)) {
        next.delete(chainId)
      } else {
        next.add(chainId)
      }
      return next
    })
  }

  const selectAllEvm = () => {
    setSelectedChains(new Set(EVM_CHAIN_IDS))
  }

  // Auto-detect chains when address changes
  const handleAddressChange = (val: string) => {
    setAddress(val)
    const trimmed = val.trim()
    if (trimmed.startsWith("0x") && trimmed.length >= 4) {
      setSelectedChains(new Set(EVM_CHAIN_IDS))
    } else if (/^(1|3|bc1)/i.test(trimmed)) {
      setSelectedChains(new Set(["BTC"]))
    } else if (trimmed.length >= 32 && !trimmed.startsWith("0x")) {
      setSelectedChains(new Set(["SOL"]))
    }
  }

  const handleAddWallet = () => {
    if (!address.trim() || selectedChains.size === 0) return
    addAccount.mutate(
      { chains: Array.from(selectedChains), address: address.trim() },
      { onSuccess: () => onNext() }
    )
  }

  return (
    <div className="flex flex-col items-center">
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Add Your First Wallet
      </h1>
      <p className="text-foreground-muted max-w-lg text-center mb-8 text-sm">
        Enter a blockchain address to start tracking. EVM addresses are
        automatically tracked across all supported chains.
      </p>

      <div className="max-w-lg w-full mx-auto">
        {/* Address input first */}
        <input
          type="text"
          value={address}
          onChange={(e) => handleAddressChange(e.target.value)}
          placeholder="0x... or bc1... or Solana address"
          className="w-full bg-transparent border-b border-card-border text-foreground py-3 outline-none focus:border-primary transition-colors placeholder:text-foreground-muted font-data text-sm mb-6"
        />

        {/* Chain selector grid */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-foreground-muted">
            Chains ({selectedChains.size} selected)
          </span>
          {isEvm && selectedChains.size < EVM_CHAIN_IDS.length && (
            <button
              onClick={selectAllEvm}
              className="text-foreground-muted hover:text-primary transition-colors text-xs"
            >
              Select all EVM
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {SUPPORTED_CHAINS.map((chain) => {
            const isSelected = selectedChains.has(chain.id)
            const isEvmChain = EVM_CHAIN_IDS.includes(chain.id)
            const dimmed = (isEvm && !isEvmChain) || (isBtc && chain.id !== "BTC")
            const chainColor = getChainColor(chain.id)

            return (
              <button
                key={chain.id}
                onClick={() => toggleChain(chain.id)}
                disabled={dimmed}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors text-sm ${
                  isSelected
                    ? "text-foreground"
                    : dimmed
                      ? "border-card-border text-foreground-muted opacity-30 cursor-not-allowed"
                      : "border-card-border text-foreground-muted hover:border-card-border-hover hover:text-foreground"
                }`}
                style={isSelected ? {
                  borderColor: hexToRgba(chainColor, 0.5),
                  backgroundColor: hexToRgba(chainColor, 0.08),
                } : undefined}
              >
                <span className={dimmed ? "opacity-20" : ""}>
                  <ChainIcon chainId={chain.id} size={16} />
                </span>
                <span className="font-data text-xs font-medium">
                  {chain.name}
                </span>
              </button>
            )
          })}
        </div>

        {addAccount.isError && (
          <p className="mt-3 text-error text-xs">
            {addAccount.error?.message || "Failed to add wallet. Please check the address and try again."}
          </p>
        )}
      </div>

      <div className="flex flex-col items-center gap-3 mt-8">
        <button
          onClick={handleAddWallet}
          disabled={!address.trim() || selectedChains.size === 0 || addAccount.isPending}
          className="btn-primary px-6 py-3"
        >
          {addAccount.isPending ? (
            <span className="flex items-center gap-2">
              <span className="material-symbols-rounded text-sm animate-spin">
                progress_activity
              </span>
              Adding to {selectedChains.size} chain{selectedChains.size !== 1 ? "s" : ""}...
            </span>
          ) : (
            `Add to ${selectedChains.size} Chain${selectedChains.size !== 1 ? "s" : ""}`
          )}
        </button>
        <button
          onClick={onNext}
          className="text-foreground-muted hover:text-foreground transition-colors text-xs"
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
