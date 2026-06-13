"use client"

import { toast } from "sonner"
import { useDisconnectGmail, type GmailAccount } from "@/hooks/use-trips"

interface GmailAccountsBarProps {
  accounts: GmailAccount[]
}

/**
 * Lists the connected Google accounts as chips (each with a Remove action) and a
 * "Connect another account" link. Shown above the trips list once at least one
 * Gmail account is connected.
 */
export function GmailAccountsBar({ accounts }: GmailAccountsBarProps) {
  const disconnect = useDisconnectGmail()

  const handleRemove = (account: GmailAccount) => {
    disconnect.mutate(account.service, {
      onSuccess: () => toast.success(`Disconnected ${account.email ?? "Gmail account"}`),
      onError: (err) =>
        toast.error(err instanceof Error ? err.message : "Failed to disconnect"),
    })
  }

  return (
    <div className="card p-3 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-foreground-muted mr-1">Connected Gmail:</span>

      {accounts.map((account) => (
        <span
          key={account.service}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs text-foreground"
          style={{ borderColor: "var(--card-border)" }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
            mail
          </span>
          {account.email ?? "Connected account"}
          <button
            type="button"
            onClick={() => handleRemove(account)}
            disabled={disconnect.isPending}
            aria-label={`Disconnect ${account.email ?? "Gmail account"}`}
            className="ml-0.5 inline-flex items-center text-foreground-muted hover:text-foreground disabled:opacity-50"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
              close
            </span>
          </button>
        </span>
      ))}

      <a
        href="/api/integrations/gmail/connect"
        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }} aria-hidden="true">
          add
        </span>
        Connect another account
      </a>
    </div>
  )
}
