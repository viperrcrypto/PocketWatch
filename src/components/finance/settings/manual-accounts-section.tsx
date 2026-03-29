"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useManualAccounts, useDeleteManualAccount } from "@/hooks/finance"
import { CollapsibleSection } from "@/components/ui/collapsible-section"

const TYPE_LABELS: Record<string, string> = {
  credit: "Credit / Debit Card",
  checking: "Checking",
  savings: "Savings",
}

/**
 * Self-contained manual accounts section.
 * Renders nothing when no manual accounts exist.
 * Renders its own CollapsibleSection wrapper when accounts are present.
 */
export function ManualAccountsSection() {
  const { data: accounts, isLoading } = useManualAccounts()
  const deleteAccount = useDeleteManualAccount()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (isLoading) return null
  if (!accounts || accounts.length === 0) return null

  const handleDelete = (id: string) => {
    setDeletingId(id)
    deleteAccount.mutate(id, {
      onSuccess: () => {
        toast.success("Account deleted")
        setConfirmId(null)
        setDeletingId(null)
      },
      onError: (err) => {
        toast.error(err.message)
        setDeletingId(null)
      },
    })
  }

  return (
    <CollapsibleSection
      title="Manual Accounts"
      icon="account_balance_wallet"
      badge={accounts.length}
      className="rounded-xl"
    >
      <div className="pt-4 space-y-3">
        <p className="text-xs text-foreground-muted">
          Manually added accounts for statement imports.
        </p>

        <div className="space-y-2">
          {accounts.map((acct) => (
            <div
              key={acct.id}
              className="flex items-center justify-between p-3 border border-card-border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-foreground-muted/10 flex items-center justify-center">
                  <span className="material-symbols-rounded text-foreground-muted" style={{ fontSize: 18 }}>
                    {acct.type === "credit" ? "credit_card" : "account_balance"}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {acct.name}
                    {acct.mask && (
                      <span className="text-foreground-muted ml-1.5">****{acct.mask}</span>
                    )}
                  </p>
                  <p className="text-xs text-foreground-muted">
                    {TYPE_LABELS[acct.type] ?? acct.type}
                    {acct.transactionCount > 0 && (
                      <span> &middot; {acct.transactionCount} transactions</span>
                    )}
                  </p>
                </div>
              </div>

              <div>
                {confirmId === acct.id ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleDelete(acct.id)}
                      disabled={deletingId === acct.id}
                      className="text-xs text-error hover:text-error/80 font-medium px-2 py-1"
                    >
                      {deletingId === acct.id ? "Deleting..." : "Confirm"}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="text-xs text-foreground-muted px-2 py-1"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(acct.id)}
                    className="p-1.5 rounded-lg text-foreground-muted hover:text-error hover:bg-error/10 transition-colors"
                    title="Delete account"
                  >
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  )
}
