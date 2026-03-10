"use client"

import { cn } from "@/lib/utils"
import { useResyncPlaidData } from "@/hooks/use-finance"
import { toast } from "sonner"

interface Institution {
  id: string; name: string; logo: string | null; lastSyncedAt: string | null
  dataTypes: Record<string, string | null>
}

const DATA_TYPE_LABELS: Record<string, string> = {
  item: "Item Info",
  identity: "Identity",
  liabilities: "Liabilities",
  investments_holdings: "Holdings",
  investments_transactions: "Inv. Transactions",
  recurring: "Recurring",
}

function timeAgo(date: string | null): string {
  if (!date) return "Never"
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusColor(date: string | null): string {
  if (!date) return "bg-foreground-muted/30"
  const hours = (Date.now() - new Date(date).getTime()) / 3600000
  if (hours < 24) return "bg-success"
  if (hours < 72) return "bg-amber-500"
  return "bg-error"
}

export function PlaidDataStatusCard({ institutions }: { institutions: Institution[] }) {
  const resync = useResyncPlaidData()

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-card-border/50">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>sync</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-foreground-muted">Plaid Data Status</span>
        </div>
        <button
          onClick={() => resync.mutate(undefined, {
            onSuccess: () => toast.success("Plaid data synced successfully"),
            onError: (err) => toast.error(err.message),
          })}
          disabled={resync.isPending}
          className="px-3 py-1.5 text-xs font-medium text-primary hover:text-primary/80 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
        >
          {resync.isPending ? "Syncing..." : "Resync All"}
        </button>
      </div>

      {institutions.length > 0 ? institutions.map((inst) => (
        <div key={inst.id} className="px-5 py-4 border-b border-card-border/30 last:border-b-0">
          <div className="flex items-center gap-2 mb-3">
            {inst.logo && <img src={inst.logo} alt="" className="w-5 h-5 rounded" />}
            <span className="text-sm font-medium text-foreground">{inst.name}</span>
            {inst.lastSyncedAt && (
              <span className="text-[10px] text-foreground-muted ml-auto">Synced {timeAgo(inst.lastSyncedAt)}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(DATA_TYPE_LABELS).map(([key, label]) => {
              const date = inst.dataTypes[key]
              return (
                <div key={key} className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-white/[0.02] rounded-lg">
                  <div className={cn("w-1.5 h-1.5 rounded-full", statusColor(date))} />
                  <span className="text-[10px] text-foreground-muted">{label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )) : (
        <p className="text-sm text-foreground-muted text-center py-8">No Plaid institutions connected</p>
      )}
    </div>
  )
}
