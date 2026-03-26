"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useClearAllData } from "@/hooks/use-clear-data"

export function ClearDataSection() {
  const clearAllData = useClearAllData()
  const [confirm, setConfirm] = useState(false)
  const [success, setSuccess] = useState(false)

  return (
    <div className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Clear All App Data</p>
          <p className="text-xs text-foreground-muted mt-0.5">
            Wipes ALL data across portfolio and finance — transactions, budgets, snapshots, subscriptions, cards, sync states, and more. This cannot be undone.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {confirm ? (
            <>
              <button
                onClick={() => {
                  clearAllData.mutate(undefined, {
                    onSuccess: () => { setConfirm(false); setSuccess(true) },
                    onError: (err) => toast.error(err.message),
                  })
                }}
                disabled={clearAllData.isPending}
                className="px-3 py-1.5 text-error border border-error/30 rounded-lg hover:bg-error hover:text-white transition-colors disabled:opacity-50 text-xs font-medium"
              >
                {clearAllData.isPending ? "Clearing..." : "Yes, Clear Everything"}
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground transition-colors text-xs"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => { setConfirm(true); setSuccess(false) }}
              className="px-3 py-1.5 border border-error/30 rounded-lg text-error hover:bg-error/5 transition-colors text-xs font-medium"
            >
              Clear All Data
            </button>
          )}
        </div>
      </div>
      {success && (
        <div className="mt-3 flex items-center gap-1.5 text-success">
          <span className="material-symbols-rounded text-sm">check_circle</span>
          <span className="text-xs font-medium">All data cleared — refresh any tab to confirm</span>
        </div>
      )}
      {clearAllData.isError && (
        <p className="mt-3 text-error text-xs">{clearAllData.error?.message || "Failed to clear data"}</p>
      )}
    </div>
  )
}
