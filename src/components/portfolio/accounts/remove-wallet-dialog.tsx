"use client"

import type { GroupedAccount } from "./types"

interface RemoveWalletDialogProps {
  address: string
  grouped: GroupedAccount[]
  isPending: boolean
  onRemove: (account: GroupedAccount) => void
  onClose: () => void
}

export function RemoveWalletDialog({
  address,
  grouped,
  isPending,
  onRemove,
  onClose,
}: RemoveWalletDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-card-border w-full max-w-sm p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-rounded text-error text-2xl">warning</span>
          <h3 className="text-foreground text-base font-semibold">
            Remove Account
          </h3>
        </div>
        <p className="text-foreground-muted mb-2 text-xs">
          This will stop tracking this address on all chains. Balance data for this address will be removed.
        </p>
        <p className="text-foreground mb-6 break-all font-data text-xs">
          {address}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              const account = grouped.find((g) => g.address === address)
              if (account) onRemove(account)
            }}
            disabled={isPending}
            className="px-4 py-2 bg-error text-white border border-error hover:bg-transparent hover:text-error transition-colors disabled:opacity-50 text-sm font-semibold"
          >
            {isPending ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  )
}
