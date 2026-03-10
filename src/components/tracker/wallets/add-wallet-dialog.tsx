"use client"

import { useState } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import type { TrackerChain } from "@/lib/tracker/types"
import { useAddTrackerWallet } from "@/hooks/use-tracker"
import { isEvmAddress, isSolanaAddress, CHAIN_CONFIGS } from "@/lib/tracker/chains"

interface AddWalletDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EVM_CHAINS: TrackerChain[] = ["ETHEREUM", "ARBITRUM", "BASE", "POLYGON", "BSC"]
const SOL_CHAINS: TrackerChain[] = ["SOLANA"]

function detectAddressType(address: string): "evm" | "solana" | null {
  if (isEvmAddress(address)) return "evm"
  if (isSolanaAddress(address)) return "solana"
  return null
}

export default function AddWalletDialog({ open, onOpenChange }: AddWalletDialogProps) {
  const [address, setAddress] = useState("")
  const [label, setLabel] = useState("")
  const [chain, setChain] = useState<TrackerChain>("ETHEREUM")
  const [error, setError] = useState("")

  const addWallet = useAddTrackerWallet()

  const addressType = address.length > 10 ? detectAddressType(address.trim()) : null

  // Auto-select chain based on address format
  const availableChains = addressType === "solana"
    ? SOL_CHAINS
    : addressType === "evm"
      ? EVM_CHAINS
      : [...EVM_CHAINS, ...SOL_CHAINS]

  const handleAddressChange = (value: string) => {
    setAddress(value)
    setError("")
    const type = value.length > 10 ? detectAddressType(value.trim()) : null
    if (type === "solana" && !SOL_CHAINS.includes(chain)) {
      setChain("SOLANA")
    } else if (type === "evm" && !EVM_CHAINS.includes(chain)) {
      setChain("ETHEREUM")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const trimmed = address.trim()
    if (!trimmed) {
      setError("Address is required")
      return
    }

    const type = detectAddressType(trimmed)
    if (!type) {
      setError("Invalid address format. Enter an EVM (0x...) or Solana address.")
      return
    }

    if (type === "solana" && chain !== "SOLANA") {
      setError("Solana address detected but non-Solana chain selected.")
      return
    }

    if (type === "evm" && chain === "SOLANA") {
      setError("EVM address detected but Solana chain selected.")
      return
    }

    try {
      await addWallet.mutateAsync({
        address: trimmed,
        label: label.trim() || undefined,
        chain,
      })
      setAddress("")
      setLabel("")
      setChain("ETHEREUM")
      onOpenChange(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add wallet"
      setError(message)
    }
  }

  const handleReset = () => {
    setAddress("")
    setLabel("")
    setChain("ETHEREUM")
    setError("")
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/70 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50
            w-full max-w-md bg-card border border-card-border rounded-xl p-0"
          style={{ borderRadius: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
            <Dialog.Title className="text-sm font-semibold uppercase tracking-wider text-foreground">
              Add Wallet
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn-ghost h-8 w-8 p-0 flex items-center justify-center">
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                  close
                </span>
              </button>
            </Dialog.Close>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Address input */}
            <div className="space-y-2">
              <label className="section-label">Wallet Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder="0x... or Solana address"
                className="w-full h-10 px-3 text-sm bg-background border border-card-border text-foreground
                  font-mono placeholder:text-foreground-muted focus:border-foreground transition-colors"
                style={{ borderRadius: 0 }}
                autoFocus
              />
              {addressType && (
                <p className="text-[11px] text-foreground-muted">
                  Detected:{" "}
                  <span className="text-foreground">
                    {addressType === "solana" ? "Solana" : "EVM"} address
                  </span>
                </p>
              )}
            </div>

            {/* Label input */}
            <div className="space-y-2">
              <label className="section-label">Label (optional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Main Wallet, Degen, Alpha..."
                className="w-full h-10 px-3 text-sm bg-background border border-card-border text-foreground
                  font-mono placeholder:text-foreground-muted focus:border-foreground transition-colors"
                style={{ borderRadius: 0 }}
              />
            </div>

            {/* Chain selector */}
            <div className="space-y-2">
              <label className="section-label">Chain</label>
              <div className="flex flex-wrap gap-2">
                {availableChains.map((c) => {
                  const config = CHAIN_CONFIGS[c]
                  const isSelected = chain === c
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setChain(c)}
                      className="h-8 px-3 text-[11px] font-semibold uppercase tracking-wider border transition-colors"
                      style={{
                        borderRadius: 0,
                        borderColor: isSelected ? config.color : "var(--card-border)",
                        color: isSelected ? config.color : "var(--foreground-muted)",
                        backgroundColor: isSelected ? `${config.color}15` : "var(--background)",
                      }}
                    >
                      {config.shortName}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 border border-error bg-error-muted rounded-lg">
                <span className="material-symbols-rounded text-error" style={{ fontSize: 16 }}>
                  error
                </span>
                <span className="text-xs text-error">{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button type="button" onClick={handleReset} className="btn-secondary">
                Reset
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={addWallet.isPending || !address.trim()}
                style={{ opacity: addWallet.isPending || !address.trim() ? 0.4 : 1 }}
              >
                {addWallet.isPending ? (
                  <>
                    <span className="loading-spinner mr-2" />
                    Adding...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-rounded mr-2" style={{ fontSize: 16 }}>
                      add
                    </span>
                    Add Wallet
                  </>
                )}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
