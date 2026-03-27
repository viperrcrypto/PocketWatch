"use client"

import { useState, useMemo } from "react"
import { toast } from "sonner"
import {
  useFinanceAccounts, useFinanceTransactions, useExchangePlaidToken,
  useConnectSimpleFIN, useSyncInstitution, useDisconnectInstitution,
  useUpdateAccount, useUpdateTransactionCategory, useLiabilities,
} from "@/hooks/use-finance"
import { formatCurrency, cn } from "@/lib/utils"
import { FinanceStatCard } from "@/components/finance/stat-card"
import { FinanceEmpty } from "@/components/finance/finance-empty"
import { FinanceCardSkeleton } from "@/components/finance/finance-loading"
import { PlaidLinkButton } from "@/components/finance/plaid-link-button"
import { SimpleFINConnect } from "@/components/finance/simplefin-connect"
import { ConfirmDialog } from "@/components/finance/confirm-dialog"
import { ACCOUNT_TYPES, normalizeType } from "@/components/finance/accounts/accounts-constants"
import { InstitutionAccordion } from "@/components/finance/accounts/institution-accordion"
import { ReconnectBanner } from "@/components/finance/accounts/reconnect-banner"
import { AccountTransactions } from "@/components/finance/accounts/account-transactions"
import { AccountLiabilityDetails } from "@/components/finance/accounts/account-liability-details"
import { StatementImportSection } from "@/components/finance/accounts/statement-import-section"
import { StaggerChildren, StaggerItem } from "@/components/motion/stagger-children"

const TYPE_ORDER = ["checking", "savings", "credit", "business_credit", "investment", "brokerage", "loan", "mortgage"]

export default function FinanceAccountsPage() {
  const [activeTab, setActiveTab] = useState("all")
  const [expandedInst, setExpandedInst] = useState<Set<string>>(new Set())
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null)
  const [txPage, setTxPage] = useState(1)
  const [disconnecting, setDisconnecting] = useState<{ id: string; name: string } | null>(null)

  const { data: institutions, isLoading, isError } = useFinanceAccounts()
  const exchangeToken = useExchangePlaidToken()
  const connectSF = useConnectSimpleFIN()
  const syncMutation = useSyncInstitution()
  const disconnectMutation = useDisconnectInstitution()
  const updateAccount = useUpdateAccount()
  const updateCategory = useUpdateTransactionCategory()
  const { data: liabilities } = useLiabilities()

  const { data: txData, isLoading: txLoading } = useFinanceTransactions({
    accountId: selectedAccount ?? undefined,
    page: txPage,
    limit: 20,
  })

  const allAccounts = useMemo(() =>
    institutions?.flatMap((inst) =>
      inst.accounts.map((acct) => ({
        ...acct, provider: inst.provider, institutionId: inst.id,
        institutionName: inst.institutionName, institutionLogo: inst.institutionLogo ?? null,
      }))
    ) ?? [],
    [institutions]
  )

  const canonical = useMemo(() =>
    allAccounts.filter((a) => !(a.provider === "simplefin" && a.linkedExternalId)),
    [allAccounts]
  )

  const typeCounts = useMemo(() => {
    const counts: Record<string, { count: number; total: number }> = {}
    for (const acct of canonical) {
      const key = normalizeType(acct.type)
      if (!counts[key]) counts[key] = { count: 0, total: 0 }
      counts[key].count++
      const isDebt = ["credit", "business_credit", "loan", "mortgage"].includes(acct.type)
      counts[key].total += isDebt ? Math.abs(acct.currentBalance ?? 0) : (acct.currentBalance ?? 0)
    }
    return counts
  }, [canonical])

  const visibleTabs = ACCOUNT_TYPES.filter((t) => t.key === "all" || (typeCounts[t.key]?.count ?? 0) > 0)

  const filteredInstitutions = useMemo(() => {
    if (!institutions) return []
    return institutions
      .map((inst) => {
        const filtered = inst.accounts
          .filter((a) => !(inst.provider === "simplefin" && a.linkedExternalId))
          .filter((a) => activeTab === "all" || normalizeType(a.type) === activeTab)
          .sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type))
        return { ...inst, accounts: filtered }
      })
      .filter((inst) => inst.accounts.length > 0 || inst.status === "error")
  }, [institutions, activeTab])

  const totalAssets = Math.round(canonical
    .filter((a) => ["checking", "savings", "investment", "brokerage"].includes(a.type))
    .reduce((sum, a) => sum + (a.currentBalance ?? 0), 0) * 100) / 100
  const totalDebt = Math.round(canonical
    .filter((a) => ["credit", "business_credit", "loan", "mortgage"].includes(a.type))
    .reduce((sum, a) => sum + Math.abs(a.currentBalance ?? 0), 0) * 100) / 100
  const netBalance = totalAssets - totalDebt
  const isConnecting = exchangeToken.isPending || connectSF.isPending

  // Detect active provider from connected institutions (one or the other, not both)
  const activeProvider = useMemo(() => {
    if (!institutions?.length) return null
    const hasSimpleFIN = institutions.some((i) => i.provider === "simplefin")
    const hasPlaid = institutions.some((i) => i.provider === "plaid")
    if (hasSimpleFIN) return "simplefin" as const
    if (hasPlaid) return "plaid" as const
    return null
  }, [institutions])

  const toggleInst = (id: string) => {
    setExpandedInst((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  const pageHeader = (
    <div className="flex items-center gap-3">
      <h1 className="text-xl font-bold tracking-tight text-foreground">Accounts</h1>
      {activeProvider !== "simplefin" && (
        <PlaidLinkButton
          onSuccess={(publicToken, metadata) => {
            toast.info("Connecting and syncing account...")
            exchangeToken.mutate(
              { publicToken, institutionId: metadata.institution.institution_id },
              {
                onSuccess: (result) => toast.success(`Connected ${result.institutionName} — ${result.accountCount} account${result.accountCount !== 1 ? "s" : ""} synced`),
                onError: (err) => toast.error(err.message),
              },
            )
          }}
          onError={(message) => toast.error(message)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
          buttonLabel="+ Connect Account"
          icon="add_link"
        />
      )}
      {activeProvider !== "plaid" && (
        <SimpleFINConnect
          onConnect={async (token) => {
            toast.info("Connecting and syncing account...")
            const result = await connectSF.mutateAsync(token)
            toast.success(`Connected ${result.institutionName}`)
          }}
          isLoading={connectSF.isPending}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors"
          buttonLabel="SimpleFIN"
        />
      )}
    </div>
  )

  if (!isLoading && !institutions?.length) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <FinanceEmpty
          icon="account_balance" title="No accounts connected"
          description="Connect your bank to start tracking finances."
          helpSteps={[
            { icon: "settings", text: "Configure API credentials in Settings" },
            { icon: "add_link", text: "Connect via Plaid or SimpleFIN" },
            { icon: "sync", text: "Accounts and transactions sync automatically" },
          ]}
          linkTo={{ label: "Go to Settings", href: "/finance/settings" }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      {isConnecting && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <span className="material-symbols-rounded text-primary animate-spin" style={{ fontSize: 20 }}>sync</span>
          <div>
            <p className="text-sm font-medium text-foreground">Connecting your bank account...</p>
            <p className="text-xs text-foreground-muted">Syncing accounts and transactions. This may take a few seconds.</p>
          </div>
        </div>
      )}

      {/* Reconnect Banner — shown when any institution has an error */}
      {institutions && <ReconnectBanner institutions={institutions} />}

      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, i) => <FinanceCardSkeleton key={i} />)}</div>
      ) : (
        <StaggerChildren className="grid grid-cols-1 sm:grid-cols-3 gap-4" staggerMs={60}>
          <StaggerItem><FinanceStatCard label="Net Balance" value={formatCurrency(netBalance)} icon="account_balance_wallet" accentColor="#3b82f6" /></StaggerItem>
          <StaggerItem><FinanceStatCard label="Total Assets" value={formatCurrency(totalAssets)} icon="savings" accentColor="#10b981" /></StaggerItem>
          <StaggerItem><FinanceStatCard label="Total Liabilities" value={formatCurrency(totalDebt)} icon="credit_card" accentColor="#ef4444" /></StaggerItem>
        </StaggerChildren>
      )}

      {/* Account Type Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => {
          const stats = tab.key === "all" ? { count: canonical.length, total: netBalance } : typeCounts[tab.key]
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setSelectedAccount(null) }}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                activeTab === tab.key ? "bg-primary text-white" : "bg-card border border-card-border text-foreground-muted hover:text-foreground hover:border-card-border-hover"
              )}
            >
              {tab.label}
              <span className="text-[10px] opacity-70">{stats?.count ?? 0}</span>
            </button>
          )
        })}
      </div>

      {/* Institution Accordions */}
      {isLoading ? (
        <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <FinanceCardSkeleton key={i} />)}</div>
      ) : (
        <div className="space-y-3">
          {filteredInstitutions.map((inst) => (
            <InstitutionAccordion
              key={inst.id}
              inst={inst}
              isOpen={expandedInst.has(inst.id)}
              onToggle={() => toggleInst(inst.id)}
              selectedAccount={selectedAccount}
              onSelectAccount={(id) => { setSelectedAccount(id); setTxPage(1) }}
              onSync={() => syncMutation.mutate(inst.id)}
              onDisconnect={() => setDisconnecting({ id: inst.id, name: inst.institutionName })}
              onRenameAccount={(accountId, name) => updateAccount.mutate({ accountId, name })}
              onChangeAccountType={(accountId, type) =>
                updateAccount.mutate({ accountId, type }, { onSuccess: () => toast.success(`Account type changed to ${type}`) })
              }
              onToggleHidden={(accountId, isHidden) =>
                updateAccount.mutate({ accountId, isHidden }, { onSuccess: () => toast.success(isHidden ? "Account hidden" : "Account shown") })
              }
              onReconnect={inst.status === "error" ? () => {
                document.getElementById("reconnect-banner")?.scrollIntoView({ behavior: "smooth", block: "center" })
              } : undefined}
              syncPending={syncMutation.isPending}
            />
          ))}
        </div>
      )}

      {selectedAccount && (
        <AccountTransactions
          selectedAccount={selectedAccount}
          txData={txData}
          txLoading={txLoading}
          txPage={txPage}
          onPageChange={setTxPage}
          onCategoryChange={(txId, category, createRule) =>
            updateCategory.mutate({ transactionId: txId, category, createRule })
          }
        />
      )}

      {selectedAccount && (
        <AccountLiabilityDetails
          account={allAccounts.find((a) => a.id === selectedAccount)}
          liabilities={liabilities}
        />
      )}

      {/* Statement Import */}
      <StatementImportSection />

      <ConfirmDialog
        open={!!disconnecting}
        onClose={() => setDisconnecting(null)}
        onConfirm={() => {
          if (disconnecting) {
            disconnectMutation.mutate(disconnecting.id, {
              onSuccess: () => { toast.success(`Disconnected ${disconnecting.name}`); setDisconnecting(null) },
              onError: (err) => toast.error(err.message),
            })
          }
        }}
        title={`Disconnect ${disconnecting?.name ?? ""}?`}
        description="This will remove all accounts and transaction data from this institution. This action cannot be undone."
        confirmLabel="Disconnect"
        variant="danger"
        isLoading={disconnectMutation.isPending}
      />
    </div>
  )
}
