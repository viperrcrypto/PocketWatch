"use client"

import { toast } from "sonner"
import { formatCurrency, cn } from "@/lib/utils"
import { InstitutionLogo } from "@/components/finance/institution-logo"
import { AccountTypeBadge } from "@/components/finance/account-type-badge"
import { AccountTypeSelector } from "@/components/finance/account-type-selector"
import { EditableName } from "./editable-name"
import { TYPE_ICONS } from "./accounts-constants"

interface Account {
  id: string
  name: string
  type: string
  mask?: string | null
  officialName?: string | null
  currentBalance?: number | null
  creditLimit?: number | null
  isHidden?: boolean
}

interface Institution {
  id: string
  institutionName: string
  institutionLogo?: string | null
  provider: string
  status: string
  errorMessage?: string | null
  lastSyncedAt?: string | null
  accounts: Account[]
}

export function InstitutionAccordion({
  inst,
  isOpen,
  onToggle,
  selectedAccount,
  onSelectAccount,
  onSync,
  onDisconnect,
  onRenameAccount,
  onChangeAccountType,
  onToggleHidden,
  syncPending,
}: {
  inst: Institution
  isOpen: boolean
  onToggle: () => void
  selectedAccount: string | null
  onSelectAccount: (id: string | null) => void
  onSync: () => void
  onDisconnect: () => void
  onRenameAccount: (accountId: string, name: string) => void
  onChangeAccountType: (accountId: string, type: string) => void
  onToggleHidden: (accountId: string, isHidden: boolean) => void
  syncPending: boolean
}) {
  const instTotal = inst.accounts.reduce((sum, a) => {
    const isDebt = ["credit", "business_credit", "loan", "mortgage"].includes(a.type)
    return sum + (isDebt ? -(Math.abs(a.currentBalance ?? 0)) : (a.currentBalance ?? 0))
  }, 0)

  return (
    <div className="bg-card border border-card-border rounded-xl overflow-hidden">
      {/* Accordion Header */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle() } }}
        className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-background-secondary/30 transition-colors cursor-pointer"
      >
        <InstitutionLogo src={inst.institutionLogo} size={8} />
        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">{inst.institutionName}</span>
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", inst.status === "active" ? "bg-success" : "bg-error")} />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-foreground-muted">{inst.accounts.length} account{inst.accounts.length !== 1 ? "s" : ""}</span>
            {inst.lastSyncedAt && (
              <span className="text-[10px] text-foreground-muted">
                · synced {new Date(inst.lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-semibold text-foreground tabular-nums font-data">{formatCurrency(instTotal)}</span>
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={onSync}
              disabled={syncPending}
              className="p-1.5 rounded-md text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
              title="Sync"
            >
              <span className={cn("material-symbols-rounded", syncPending && "animate-spin")} style={{ fontSize: 16 }}>sync</span>
            </button>
            <button
              onClick={onDisconnect}
              className="p-1.5 rounded-md text-foreground-muted hover:text-error hover:bg-error/10 transition-colors"
              title="Disconnect"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>link_off</span>
            </button>
          </div>
          <span className={cn("material-symbols-rounded text-foreground-muted transition-transform duration-200", isOpen && "rotate-180")} style={{ fontSize: 18 }}>
            expand_more
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {inst.status === "error" && inst.errorMessage && (
        <div className="flex items-center gap-2 px-5 py-2.5 bg-error/5 border-t border-error/20">
          <span className="material-symbols-rounded text-error" style={{ fontSize: 16 }}>warning</span>
          <span className="text-xs text-error flex-1">{inst.errorMessage}</span>
          <span className="text-[10px] text-error/60">Reconnect required</span>
        </div>
      )}

      {/* Accordion Body -- Account Rows */}
      {isOpen && (
        <div className="border-t border-card-border/50">
          {inst.accounts.map((acct) => {
            const isDebt = ["credit", "business_credit", "loan", "mortgage"].includes(acct.type)
            const balance = acct.currentBalance ?? 0
            const isActive = selectedAccount === acct.id
            const utilization = acct.creditLimit ? (Math.abs(balance) / acct.creditLimit) * 100 : null

            return (
              <div
                key={acct.id}
                className={cn(
                  "group flex items-center gap-3 px-5 py-3 border-b border-card-border/30 last:border-b-0 cursor-pointer transition-colors",
                  isActive ? "bg-primary/5" : "hover:bg-background-secondary/30"
                )}
                onClick={() => onSelectAccount(isActive ? null : acct.id)}
              >
                <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 20 }}>{TYPE_ICONS[acct.type] ?? "account_balance"}</span>
                <div className="flex-1 min-w-0">
                  <EditableName value={acct.name} onSave={(name) => onRenameAccount(acct.id, name)} />
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <AccountTypeSelector type={acct.type} onChangeType={(type) => onChangeAccountType(acct.id, type)} />
                    {acct.mask && <span className="text-[10px] text-foreground-muted tabular-nums">••{acct.mask}</span>}
                    {acct.officialName && acct.officialName !== acct.name && (
                      <span className="text-[10px] text-foreground-muted truncate max-w-[200px]">{acct.officialName}</span>
                    )}
                  </div>
                </div>
                {utilization != null && acct.creditLimit != null && (
                  <div className="w-20 flex-shrink-0 hidden sm:block">
                    <div className="w-full h-1 rounded-full bg-background-secondary overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          utilization >= 75 ? "bg-error" : utilization >= 50 ? "bg-orange-500" : utilization >= 30 ? "bg-amber-500" : "bg-success"
                        )}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-foreground-muted tabular-nums">{utilization.toFixed(0)}% of {formatCurrency(acct.creditLimit)}</span>
                  </div>
                )}
                <span className={cn("text-sm font-semibold tabular-nums font-data flex-shrink-0", isDebt ? "text-error" : "text-foreground")}>
                  {isDebt ? "-" : ""}{formatCurrency(Math.abs(balance))}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleHidden(acct.id, !acct.isHidden) }}
                  className="p-1 rounded text-foreground-muted hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                  title={acct.isHidden ? "Show account" : "Hide account"}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{acct.isHidden ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
