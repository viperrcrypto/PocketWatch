"use client"

import { useState } from "react"
import {
  useWipeChartData,
  useWipeAndRestartSync,
  useSyncProgress,
} from "@/hooks/use-portfolio-tracker"
import { CollapsibleSection } from "./collapsible-section"
import { DataQualityCheck } from "./data-quality-check"

export function DataManagementSection() {
  const wipeChartData = useWipeChartData()
  const [wipeConfirm, setWipeConfirm] = useState(false)
  const [wipeSuccess, setWipeSuccess] = useState(false)

  const wipeAndRestart = useWipeAndRestartSync()
  const [nukeConfirm, setNukeConfirm] = useState(false)
  const [nukeSuccess, setNukeSuccess] = useState(false)

  const { refetch: refetchSync } = useSyncProgress({ advance: false, reconstruct: false, autoStart: false })

  const handleWipeChart = () => {
    setWipeSuccess(false)
    wipeChartData.mutate(undefined, {
      onSuccess: () => { setWipeConfirm(false); setWipeSuccess(true) },
    })
  }

  const handleNukeAndRestart = () => {
    setNukeSuccess(false)
    wipeAndRestart.mutate(undefined, {
      onSuccess: () => {
        setNukeConfirm(false)
        setNukeSuccess(true)
        setTimeout(() => refetchSync(), 1000)
      },
    })
  }

  return (
    <CollapsibleSection
      title="Data Management"
      subtitle="Reset or clear cached portfolio data"
    >
      <div className="p-5">
        {/* Reset Chart Data */}
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Reset Chart Data</p>
            <p className="text-xs text-foreground-muted mt-0.5">
              Clears all cached chart history, snapshots, and sync states. The chart will start fresh from your current portfolio value.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {wipeConfirm ? (
              <>
                <button onClick={handleWipeChart} disabled={wipeChartData.isPending} className="px-3 py-1.5 text-error border border-error/30 rounded-lg hover:bg-error hover:text-white transition-colors disabled:opacity-50 text-xs font-medium">
                  {wipeChartData.isPending ? "Clearing..." : "Confirm"}
                </button>
                <button onClick={() => setWipeConfirm(false)} className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground transition-colors text-xs">
                  Cancel
                </button>
              </>
            ) : (
              <button onClick={() => { setWipeConfirm(true); setWipeSuccess(false) }} className="px-3 py-1.5 border border-error/30 rounded-lg text-error hover:bg-error/5 transition-colors text-xs font-medium">
                Reset Chart
              </button>
            )}
          </div>
        </div>
        {wipeSuccess && (
          <div className="mt-3 flex items-center gap-1.5 text-success">
            <span className="material-symbols-rounded text-sm">check_circle</span>
            <span className="text-xs font-medium">
              Chart data cleared — {wipeChartData.data?.purged?.snapshots ?? 0} snapshots, {wipeChartData.data?.purged?.chartCache ?? 0} cache rows removed
            </span>
          </div>
        )}
        {wipeChartData.isError && (
          <p className="mt-3 text-error text-xs">{wipeChartData.error?.message || "Failed to clear chart data"}</p>
        )}

        {/* Nuclear Wipe & Restart */}
        <div className="mt-4 pt-4 border-t border-card-border">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Wipe All Transactions & Restart Sync</p>
              <p className="text-xs text-foreground-muted mt-0.5">
                Deletes ALL cached transactions, sync states, throttle gates, charts, and snapshots — then starts a completely fresh sync. Use this if data quality is bad.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {nukeConfirm ? (
                <>
                  <button onClick={handleNukeAndRestart} disabled={wipeAndRestart.isPending} className="px-3 py-1.5 text-error border border-error/30 rounded-lg hover:bg-error hover:text-white transition-colors disabled:opacity-50 text-xs font-medium">
                    {wipeAndRestart.isPending ? "Wiping..." : "Yes, Wipe Everything"}
                  </button>
                  <button onClick={() => setNukeConfirm(false)} className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground transition-colors text-xs">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => { setNukeConfirm(true); setNukeSuccess(false) }} className="px-3 py-1.5 border border-error/30 rounded-lg text-error hover:bg-error/5 transition-colors text-xs font-medium">
                  Wipe & Restart
                </button>
              )}
            </div>
          </div>
          {nukeSuccess && (
            <div className="mt-3 flex items-center gap-1.5 text-success">
              <span className="material-symbols-rounded text-sm">check_circle</span>
              <span className="text-xs font-medium">
                All data wiped — {wipeAndRestart.data?.purged?.transactionCache ?? 0} tx rows, {wipeAndRestart.data?.purged?.syncStates ?? 0} sync states, {wipeAndRestart.data?.purged?.providerGates ?? 0} throttle gates cleared. Fresh sync started.
              </span>
            </div>
          )}
          {wipeAndRestart.isError && (
            <p className="mt-3 text-error text-xs">{wipeAndRestart.error?.message || "Failed to wipe data"}</p>
          )}
        </div>

        {/* Clear All App Data */}
        <div className="mt-4 pt-4 border-t border-card-border">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Clear All App Data</p>
              <p className="text-xs text-foreground-muted mt-0.5">
                Wipes ALL cached data across portfolio and finance — transactions, budgets, snapshots, subscriptions, cards, sync states, and more. Use this if data is still showing after disconnecting all accounts.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {clearAllConfirm ? (
                <>
                  <button onClick={handleClearAllData} disabled={clearAllData.isPending} className="px-3 py-1.5 text-error border border-error/30 rounded-lg hover:bg-error hover:text-white transition-colors disabled:opacity-50 text-xs font-medium">
                    {clearAllData.isPending ? "Clearing..." : "Yes, Clear Everything"}
                  </button>
                  <button onClick={() => setClearAllConfirm(false)} className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground transition-colors text-xs">
                    Cancel
                  </button>
                </>
              ) : (
                <button onClick={() => { setClearAllConfirm(true); setClearAllSuccess(false) }} className="px-3 py-1.5 border border-error/30 rounded-lg text-error hover:bg-error/5 transition-colors text-xs font-medium">
                  Clear All Data
                </button>
              )}
            </div>
          </div>
          {clearAllSuccess && (
            <div className="mt-3 flex items-center gap-1.5 text-success">
              <span className="material-symbols-rounded text-sm">check_circle</span>
              <span className="text-xs font-medium">All app data cleared — refresh any tab to confirm</span>
            </div>
          )}
          {clearAllData.isError && (
            <p className="mt-3 text-error text-xs">{clearAllData.error?.message || "Failed to clear data"}</p>
          )}
        </div>

        {/* Data Quality Check */}
        <DataQualityCheck refetchSync={refetchSync} />
      </div>
    </CollapsibleSection>
  )
}
