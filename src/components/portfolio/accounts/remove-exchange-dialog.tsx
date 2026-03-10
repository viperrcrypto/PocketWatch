"use client"

interface RemoveExchangeDialogProps {
  exchangeId: string
  exchangeLabel: string
  isPending: boolean
  onRemove: (exchangeId: string) => void
  onClose: () => void
}

export function RemoveExchangeDialog({
  exchangeId,
  exchangeLabel,
  isPending,
  onRemove,
  onClose,
}: RemoveExchangeDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-card-border w-full max-w-sm p-6 rounded-xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="material-symbols-rounded text-error text-2xl">warning</span>
          <h3 className="text-foreground text-base font-semibold">
            Disconnect Exchange
          </h3>
        </div>
        <p className="text-foreground-muted mb-6 text-xs">
          This will remove the API credentials for {exchangeLabel}. Exchange balances will no longer be tracked.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onRemove(exchangeId)}
            disabled={isPending}
            className="px-4 py-2 bg-error text-white border border-error hover:bg-transparent hover:text-error transition-colors disabled:opacity-50 text-sm font-semibold"
          >
            {isPending ? "Disconnecting..." : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  )
}
