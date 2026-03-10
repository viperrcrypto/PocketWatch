import Link from "next/link"
import { toast } from "sonner"
import { SimpleFINConnect } from "@/components/finance/simplefin-connect"
import { PlaidLinkButton } from "@/components/finance/plaid-link-button"

interface Institution {
  provider: string
  [key: string]: any
}

export function SettingsProviderCards({
  verificationBadge,
  plaidInstitutions,
  simplefinInstitutions,
  connectSF,
  exchangeToken,
}: {
  verificationBadge: { label: string; tone: string }
  plaidInstitutions: Institution[]
  simplefinInstitutions: Institution[]
  connectSF: { mutateAsync: (token: string) => Promise<{ institutionName: string }>; isPending: boolean }
  exchangeToken: { mutate: (args: any, opts?: any) => void }
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Plaid */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Plaid</p>
            <p className="text-xs text-foreground-muted mt-0.5">
              API-based bank linking with Plaid Link
            </p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${verificationBadge.tone}`}>
            {verificationBadge.label}
          </span>
        </div>
        <div className="text-xs text-foreground-muted">
          Connected institutions: <span className="text-foreground font-semibold">{plaidInstitutions.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <PlaidLinkButton
            onSuccess={(publicToken, metadata) => {
              exchangeToken.mutate(
                { publicToken, institutionId: metadata.institution.institution_id },
                {
                  onSuccess: (result: { institutionName: string }) => toast.success(`Connected ${result.institutionName}`),
                  onError: (err: Error) => toast.error(err.message),
                },
              )
            }}
            onError={(message) => toast.error(message)}
            className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
            buttonLabel="Connect via Plaid"
          />
          <Link href="/finance/accounts" className="text-xs text-primary hover:underline">
            Manage accounts
          </Link>
        </div>
      </div>

      {/* SimpleFIN */}
      <div className="bg-card border border-card-border rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">SimpleFIN</p>
            <p className="text-xs text-foreground-muted mt-0.5">
              Direct setup-token connection via SimpleFIN Bridge
            </p>
          </div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${
            simplefinInstitutions.length > 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          }`}>
            {simplefinInstitutions.length > 0 ? "Connected" : "Not connected"}
          </span>
        </div>
        <div className="text-xs text-foreground-muted">
          Connected institutions: <span className="text-foreground font-semibold">{simplefinInstitutions.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <SimpleFINConnect
            onConnect={async (setupToken) => {
              const result = await connectSF.mutateAsync(setupToken)
              toast.success(`Connected ${result.institutionName}`)
            }}
            isLoading={connectSF.isPending}
            buttonLabel="Connect via SimpleFIN"
            className="btn-secondary flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
          />
          <Link href="/finance/accounts" className="text-xs text-primary hover:underline">
            View accounts
          </Link>
        </div>
      </div>
    </div>
  )
}
