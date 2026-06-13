"use client"

import { use, useMemo, useState } from "react"
import Link from "next/link"
import { useFinanceAccounts, useLiabilities } from "@/hooks/use-finance"
import { useFinanceTransactions, useUpdateTransactionCategory } from "@/hooks/finance/use-transactions"
import { AccountTransactions } from "@/components/finance/accounts/account-transactions"
import { AccountLiabilityDetails } from "@/components/finance/accounts/account-liability-details"
import { InstitutionLogo } from "@/components/finance/institution-logo"
import { AccountTypeBadge } from "@/components/finance/account-type-badge"
import { TYPE_ICONS } from "@/components/finance/accounts/accounts-constants"
import { formatCurrency, cn } from "@/lib/utils"

const DEBT_TYPES = ["credit", "business_credit", "loan", "mortgage"]

export default function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = use(params)
  const { data: institutions, isLoading } = useFinanceAccounts()
  const { data: liabilities } = useLiabilities()
  const updateCategory = useUpdateTransactionCategory()
  const [txPage, setTxPage] = useState(1)

  const { data: txData, isLoading: txLoading } = useFinanceTransactions({
    accountId,
    page: txPage,
    limit: 20,
  })

  const account = useMemo(() => {
    if (!institutions) return null
    for (const inst of institutions) {
      const acct = inst.accounts.find((a) => a.id === accountId)
      if (acct) {
        return { ...acct, institutionName: inst.institutionName, institutionLogo: inst.institutionLogo ?? null, provider: inst.provider }
      }
    }
    return null
  }, [institutions, accountId])

  if (!isLoading && !account) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="material-symbols-rounded text-foreground-muted mb-4" style={{ fontSize: 48 }}>account_balance</span>
        <p className="text-foreground-muted text-sm">Account not found</p>
        <Link href="/finance/accounts" className="text-primary text-sm font-medium mt-2 hover:underline">Back to Accounts</Link>
      </div>
    )
  }

  const isDebt = account ? DEBT_TYPES.includes(account.type) : false
  const balance = account?.currentBalance ?? 0
  const utilization = account?.creditLimit ? (Math.abs(balance) / account.creditLimit) * 100 : null

  return (
    <div className="space-y-6 pb-12">
      {/* Back */}
      <Link href="/finance/accounts" className="inline-flex items-center gap-1.5 text-primary hover:text-primary-hover transition-colors text-sm font-medium">
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_back</span>
        Back to Accounts
      </Link>

      {/* Hero */}
      {isLoading || !account ? (
        <div className="h-[140px] animate-shimmer rounded-2xl" />
      ) : (
        <div className="bg-card border border-card-border rounded-2xl p-6" style={{ boxShadow: "var(--shadow-sm)" }}>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              {account.institutionLogo ? (
                <InstitutionLogo src={account.institutionLogo} size={10} />
              ) : (
                <span className="material-symbols-rounded text-primary" style={{ fontSize: 24 }}>{TYPE_ICONS[account.type] ?? "account_balance"}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-foreground truncate">{account.name}</h1>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs text-foreground-muted">{account.institutionName}</span>
                <AccountTypeBadge type={account.type} />
                {account.mask && <span className="text-[11px] text-foreground-muted tabular-nums">••{account.mask}</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-foreground-muted">{isDebt ? "Balance Owed" : "Balance"}</p>
              <p className={cn("text-2xl font-black font-data tabular-nums mt-0.5", isDebt ? "text-error" : "text-foreground")} style={{ letterSpacing: "-0.03em" }}>
                {isDebt ? "-" : ""}{formatCurrency(Math.abs(balance))}
              </p>
              {utilization != null && account.creditLimit != null && (
                <p className="text-[10px] text-foreground-muted mt-1 tabular-nums">
                  {utilization.toFixed(0)}% of {formatCurrency(account.creditLimit)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Liability details (credit/loan) */}
      {account && (
        <AccountLiabilityDetails account={account} liabilities={liabilities} />
      )}

      {/* Transactions / Activity */}
      <AccountTransactions
        selectedAccount={accountId}
        txData={txData}
        txLoading={txLoading}
        txPage={txPage}
        onPageChange={setTxPage}
        onCategoryChange={(txId, category, createRule) =>
          updateCategory.mutate({ transactionId: txId, category, createRule })
        }
      />
    </div>
  )
}
