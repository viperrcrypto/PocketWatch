"use client"

import { Facehash } from "facehash"
import { shortenAddress, formatFiatValue } from "@/lib/portfolio/utils"
import { ChainBadge } from "@/components/portfolio/chain-badge"
import { ChainIcon } from "@/components/portfolio/chain-icon"
import { SUPPORTED_CHAINS, getChainMeta, getChainColor, hexToRgba } from "@/lib/portfolio/chains"
import type { GroupedAccount } from "./types"

interface WalletCardProps {
  account: GroupedAccount
  walletBalance: number | undefined
  isSyncing: boolean
  noApiKey: boolean
  copiedAddress: string | null
  editingAddress: string | null
  editLabel: string
  editingChainsAddress: string | null
  editChains: Set<string>
  updateChainsPending: boolean
  onCopy: (address: string) => void
  onConfirmRemove: (address: string) => void
  onStartEdit: (account: GroupedAccount) => void
  onEditLabelChange: (val: string) => void
  onSaveLabel: (address: string) => void
  onCancelEdit: () => void
  onStartEditChains: (account: GroupedAccount) => void
  onToggleEditChain: (chainId: string) => void
  onSaveChains: (address: string) => void
  onCancelEditChains: () => void
}

export function WalletCard({
  account,
  walletBalance,
  isSyncing,
  noApiKey,
  copiedAddress,
  editingAddress,
  editLabel,
  editingChainsAddress,
  editChains,
  updateChainsPending,
  onCopy,
  onConfirmRemove,
  onStartEdit,
  onEditLabelChange,
  onSaveLabel,
  onCancelEdit,
  onStartEditChains,
  onToggleEditChain,
  onSaveChains,
  onCancelEditChains,
}: WalletCardProps) {
  return (
    <div className="group/card bg-card border border-card-border p-6 hover:border-card-border-hover transition-colors rounded-xl">
      {/* Address row */}
      <div className="flex items-center gap-4 mb-4">
        <div
          className="flex-shrink-0 group/facehash"
          style={{
            perspective: "600px",
            overflow: "visible",
            pointerEvents: "auto",
          }}
        >
          <Facehash
            key={account.address}
            name={account.address}
            size={40}
            variant="gradient"
            intensity3d="dramatic"
            interactive
            showInitial={false}
            colors={["#ec4899", "#f59e0b", "#3b82f6", "#f97316", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4"]}
            className="rounded-lg"
            style={{
              willChange: "transform",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement
              el.style.transform = "scale(1.12) rotateY(8deg)"
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement
              el.style.transform = ""
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          {editingAddress === account.address ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                type="text"
                value={editLabel}
                onChange={(e) => onEditLabelChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSaveLabel(account.address)
                  if (e.key === "Escape") onCancelEdit()
                }}
                onBlur={() => onSaveLabel(account.address)}
                placeholder="Enter a label..."
                className="bg-transparent border-b border-card-border focus:border-foreground outline-none py-0.5 text-foreground placeholder-foreground-muted transition-colors font-data text-sm w-48"
              />
              <span className="text-foreground-muted font-data text-xs">
                {shortenAddress(account.address, 6)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {account.label ? (
                <>
                  <span className="text-foreground truncate font-data text-sm font-medium">
                    {account.label}
                  </span>
                  <span className="text-foreground-muted truncate font-data text-xs">
                    {shortenAddress(account.address, 6)}
                  </span>
                </>
              ) : (
                <span className="text-foreground truncate font-data text-sm font-medium">
                  {shortenAddress(account.address, 8)}
                </span>
              )}
              <button
                onClick={() => onStartEdit(account)}
                className="p-0.5 text-foreground-muted hover:text-foreground transition-colors opacity-0 group-hover/card:opacity-100"
                title="Rename wallet"
              >
                <span className="material-symbols-rounded text-sm">edit</span>
              </button>
            </div>
          )}
          <p className="text-foreground-muted mt-0.5 text-xs">
            Tracked on {account.chains.length} chain{account.chains.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Total Balance / Sync Status */}
        <WalletBalanceDisplay
          balance={walletBalance}
          isSyncing={isSyncing}
          noApiKey={noApiKey}
        />

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => onCopy(account.address)}
            className="p-2 text-foreground-muted hover:text-foreground transition-colors"
            title="Copy address"
          >
            <span className="material-symbols-rounded text-base">
              {copiedAddress === account.address ? "check" : "content_copy"}
            </span>
          </button>
          <button
            onClick={() => onConfirmRemove(account.address)}
            className="p-2 text-foreground-muted hover:text-error transition-colors"
            title="Remove account"
          >
            <span className="material-symbols-rounded text-base">delete</span>
          </button>
        </div>
      </div>

      {/* Chain badges */}
      {editingChainsAddress === account.address ? (
        <ChainEditor
          account={account}
          editChains={editChains}
          updateChainsPending={updateChainsPending}
          onToggleEditChain={onToggleEditChain}
          onSaveChains={onSaveChains}
          onCancelEditChains={onCancelEditChains}
        />
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-2">
            {account.chains.map((chainId) => (
              <ChainBadge key={chainId} chainId={chainId} size="sm" />
            ))}
          </div>
          <button
            onClick={() => onStartEditChains(account)}
            className="p-1 text-foreground-muted hover:text-foreground transition-colors opacity-0 group-hover/card:opacity-100"
            title="Edit tracked chains"
          >
            <span className="material-symbols-rounded text-sm">edit</span>
          </button>
        </div>
      )}
    </div>
  )
}

function WalletBalanceDisplay({
  balance,
  isSyncing,
  noApiKey,
}: {
  balance: number | undefined
  isSyncing: boolean
  noApiKey: boolean
}) {
  if (isSyncing && (balance == null || balance === 0)) {
    return (
      <div className="flex-shrink-0 text-right mr-2">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          <span className="text-primary text-xs font-medium">Syncing...</span>
        </div>
        <p className="text-foreground-muted mt-0.5 text-xs">
          Fetching balances
        </p>
      </div>
    )
  }
  if (balance != null && balance > 0) {
    return (
      <div className="flex-shrink-0 text-right mr-2">
        <span className="text-foreground font-data text-base font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatFiatValue(balance)}
        </span>
        <p className="text-foreground-muted mt-0.5 text-xs">
          {isSyncing ? "Syncing history..." : "Total Balance"}
        </p>
      </div>
    )
  }
  if (noApiKey) {
    return (
      <div className="flex-shrink-0 text-right mr-2">
        <span className="text-warning text-xs">
          API Key Required
        </span>
      </div>
    )
  }
  return null
}

function ChainEditor({
  account,
  editChains,
  updateChainsPending,
  onToggleEditChain,
  onSaveChains,
  onCancelEditChains,
}: {
  account: GroupedAccount
  editChains: Set<string>
  updateChainsPending: boolean
  onToggleEditChain: (chainId: string) => void
  onSaveChains: (address: string) => void
  onCancelEditChains: () => void
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        {SUPPORTED_CHAINS.filter((c) => c.id !== "SOLANA").map((chain) => {
          const isSolWallet = account.chains.some((c) => {
            const meta = getChainMeta(c)
            return meta?.id === "SOL"
          })
          const isEvmWallet = account.chains.some((c) => {
            const meta = getChainMeta(c)
            return meta?.isEvm
          })
          const dimmed = (isSolWallet && chain.isEvm) || (isEvmWallet && !chain.isEvm && chain.id !== "SOL")
          const isSelected = editChains.has(chain.id)
          const chainColor = getChainColor(chain.id)

          return (
            <button
              key={chain.id}
              onClick={() => onToggleEditChain(chain.id)}
              disabled={dimmed}
              className={`flex items-center gap-1.5 px-2.5 py-1 border transition-all rounded-md text-xs font-medium ${
                isSelected
                  ? "text-foreground"
                  : dimmed
                    ? "border-card-border text-foreground-muted/20 cursor-not-allowed"
                    : "border-card-border text-foreground-muted/40 hover:text-foreground-muted hover:border-card-border-hover"
              }`}
              style={{
                ...(isSelected ? {
                  borderColor: hexToRgba(chainColor, 0.5),
                  backgroundColor: hexToRgba(chainColor, 0.08),
                } : {}),
              }}
            >
              <ChainIcon chainId={chain.id} size={12} />
              {chain.name}
            </button>
          )
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSaveChains(account.address)}
          disabled={editChains.size === 0 || updateChainsPending}
          className="px-3 py-1 btn-primary text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          {updateChainsPending ? "Saving..." : `Save (${editChains.size} chain${editChains.size !== 1 ? "s" : ""})`}
        </button>
        <button
          onClick={onCancelEditChains}
          className="px-3 py-1 border border-card-border text-foreground-muted hover:text-foreground text-xs transition-colors"
        >
          Cancel
        </button>
        {editChains.size === 0 && (
          <span className="text-error text-xs">Select at least one chain</span>
        )}
      </div>
    </div>
  )
}
