import { ENVIRONMENTS } from "./settings-constants"
import type { FinanceVerificationState } from "@/lib/finance/verification-types"

interface PlaidConfig {
  maskedKey: string
  environment: string
}

export function SettingsPlaidKeys({
  isLoading,
  isConfigured,
  plaidConfig,
  verificationState,
  verificationBadge,
  verifyCode,
  verifyError,
  verifyCredPending,
  clientId,
  secret,
  environment,
  error,
  saved,
  savePending,
  onClientIdChange,
  onSecretChange,
  onEnvironmentChange,
  onSave,
  onRetest,
  onDelete,
}: {
  isLoading: boolean
  isConfigured: boolean
  plaidConfig: PlaidConfig | null
  verificationState: FinanceVerificationState
  verificationBadge: { label: string; tone: string }
  verifyCode: string
  verifyError: string | null
  verifyCredPending: boolean
  clientId: string
  secret: string
  environment: string
  error: string
  saved: boolean
  savePending: boolean
  onClientIdChange: (value: string) => void
  onSecretChange: (value: string) => void
  onEnvironmentChange: (value: string) => void
  onSave: () => void
  onRetest: () => void
  onDelete: () => void
}) {
  return (
    <div className="bg-card border border-card-border rounded-xl">
      <div className="px-5 py-4 border-b border-card-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 bg-background border border-card-border rounded-lg">
              <span className="material-symbols-rounded text-lg text-foreground-muted">key</span>
            </div>
            <div>
              <h2 className="text-foreground text-sm font-semibold">Plaid API Keys</h2>
              <p className="text-foreground-muted text-xs mt-0.5">
                Save credentials and verify before connecting institutions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                verificationState === "verified"
                  ? "bg-success"
                  : verificationState === "failed"
                    ? "bg-error"
                    : "bg-warning"
              }`}
            />
            <span className="text-xs font-medium text-foreground-muted">
              {verificationBadge.label}
            </span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-5 space-y-4">
          <div className="h-10 bg-card-border/30 animate-pulse rounded-lg" />
          <div className="h-10 bg-card-border/30 animate-pulse rounded-lg" />
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {isConfigured && plaidConfig && (
            <div className="flex items-center justify-between bg-background-secondary rounded-lg px-4 py-3">
              <div>
                <p className="text-xs text-foreground-muted font-medium">Current Client ID</p>
                <p className="text-sm font-mono text-foreground mt-0.5">
                  {plaidConfig.maskedKey}
                </p>
                {verifyCode !== "unknown" && (
                  <p className="text-[11px] text-foreground-muted mt-1">Verify code: {verifyCode}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-semibold uppercase tracking-wide">
                  {plaidConfig.environment}
                </span>
                <button
                  onClick={onRetest}
                  disabled={verifyCredPending}
                  className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground transition-colors text-xs"
                >
                  {verifyCredPending ? "Testing..." : "Retest"}
                </button>
                <button
                  onClick={onDelete}
                  className="p-1.5 text-foreground-muted hover:text-error transition-colors rounded-lg hover:bg-error/5"
                  title="Delete credentials"
                >
                  <span className="material-symbols-rounded text-lg">delete</span>
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">
              {isConfigured ? "New Client ID" : "Client ID"}
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => onClientIdChange(e.target.value)}
              placeholder="Paste your Plaid client ID..."
              className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2 px-3 text-foreground placeholder-foreground-muted/40 transition-colors text-sm font-mono"
            />
          </div>

          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">
              {isConfigured ? "New Secret" : "Secret"}
            </label>
            <input
              type="password"
              value={secret}
              onChange={(e) => onSecretChange(e.target.value)}
              placeholder="Paste your Plaid secret..."
              className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2 px-3 text-foreground placeholder-foreground-muted/40 transition-colors text-sm font-mono"
              onKeyDown={(e) => e.key === "Enter" && onSave()}
            />
          </div>

          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">
              Environment
            </label>
            <select
              value={environment}
              onChange={(e) => onEnvironmentChange(e.target.value)}
              className="w-full max-w-xs bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2.5 px-3 text-foreground transition-colors appearance-none cursor-pointer text-sm"
            >
              {ENVIRONMENTS.map((env) => (
                <option key={env.value} value={env.value} className="bg-card text-foreground">
                  {env.label} — {env.description}
                </option>
              ))}
            </select>
          </div>

          {verificationState === "failed" && verifyError && (
            <p className="text-error text-xs">{verifyError}</p>
          )}

          {error && <p className="text-error text-xs">{error}</p>}

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={onSave}
              disabled={savePending}
              className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm font-semibold"
            >
              {savePending ? "Saving..." : isConfigured ? "Update Keys" : "Save Keys"}
            </button>
            {saved && (
              <span className="flex items-center gap-1.5 text-success">
                <span className="material-symbols-rounded text-sm">check_circle</span>
                <span className="text-xs font-medium">Saved</span>
              </span>
            )}
          </div>

          <p className="text-foreground-muted text-xs">
            Get your keys at{" "}
            <a
              href="https://dashboard.plaid.com/developers/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              dashboard.plaid.com
            </a>
            . Apply for free Development access to connect real bank accounts with limited usage.
          </p>
        </div>
      )}
    </div>
  )
}
