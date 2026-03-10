"use client"

import type { useVerifyExternalService, useRemoveExchangeConnection } from "@/hooks/use-portfolio-tracker"
import { SUPPORTED_EXCHANGES, toExchangeServiceName, getExchangeLogoUrl } from "@/lib/portfolio/exchanges"
import type { ExternalServiceVerificationState } from "@/lib/portfolio/verification"

export function ExchangeRow({
  exchange, status, deleteExchangeConfirm, setDeleteExchangeConfirm,
  verifyService, removeExchange, onOpenDialog, onDelete,
}: {
  exchange: (typeof SUPPORTED_EXCHANGES)[number]
  status: { verified: boolean; verificationState: ExternalServiceVerificationState; error?: string } | undefined
  deleteExchangeConfirm: string | null
  setDeleteExchangeConfirm: (v: string | null) => void
  verifyService: ReturnType<typeof useVerifyExternalService>
  removeExchange: ReturnType<typeof useRemoveExchangeConnection>
  onOpenDialog: (id: string) => void
  onDelete: (id: string) => void
}) {
  const isConnected = !!status
  const isDeleting = deleteExchangeConfirm === exchange.id
  const isVerifying = verifyService.isPending && verifyService.variables?.name === toExchangeServiceName(exchange.id)

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getExchangeLogoUrl(exchange.domain)}
              alt={exchange.label}
              width={32}
              height={32}
              className={`rounded-lg ${isConnected ? "opacity-100" : "opacity-40 grayscale"}`}
              style={{ imageRendering: "auto" }}
            />
            {isConnected && (
              <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                status.verificationState === "verified" ? "bg-success" : status.verificationState === "failed" ? "bg-error" : "bg-foreground-muted"
              }`} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">{exchange.label}</span>
              {isConnected && isVerifying && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-warning/10 text-warning rounded text-[10px] font-medium">Verifying...</span>
              )}
              {isConnected && !isVerifying && status.verificationState === "verified" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-success/10 text-success rounded text-[10px] font-medium">Connected</span>
              )}
              {isConnected && !isVerifying && status.verificationState === "failed" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-error/10 text-error rounded text-[10px] font-medium">Failed</span>
              )}
              {isConnected && !isVerifying && status.verificationState === "unknown" && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-foreground-muted/10 text-foreground-muted rounded text-[10px] font-medium">Not tested</span>
              )}
            </div>
            <p className="text-xs text-foreground-muted mt-0.5 truncate">{exchange.description}</p>
            {isConnected && !isVerifying && status.verificationState === "failed" && status.error && (
              <p className="text-[10px] text-error mt-0.5 truncate">{status.error}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isConnected ? (
            isDeleting ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDelete(exchange.id)}
                  disabled={removeExchange.isPending}
                  className="px-3 py-1.5 text-error border border-error/30 rounded-lg hover:bg-error hover:text-white transition-colors disabled:opacity-50 text-xs font-medium"
                >
                  {removeExchange.isPending ? "..." : "Confirm"}
                </button>
                <button onClick={() => setDeleteExchangeConfirm(null)} className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground transition-colors text-xs">
                  Cancel
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {status.verificationState !== "verified" && (
                  <button
                    onClick={() => verifyService.mutate({ name: toExchangeServiceName(exchange.id) })}
                    disabled={isVerifying}
                    className="p-1.5 text-foreground-muted hover:text-primary transition-colors rounded-lg hover:bg-primary/5 disabled:opacity-50"
                    title="Retry verification"
                  >
                    <span className="material-symbols-rounded text-lg">refresh</span>
                  </button>
                )}
                <button
                  onClick={() => setDeleteExchangeConfirm(exchange.id)}
                  className="p-1.5 text-foreground-muted hover:text-error transition-colors rounded-lg hover:bg-error/5"
                  title="Disconnect exchange"
                >
                  <span className="material-symbols-rounded text-lg">delete</span>
                </button>
              </div>
            )
          ) : (
            <button onClick={() => onOpenDialog(exchange.id)} className="px-3 py-1.5 border border-card-border rounded-lg text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-xs font-medium">
              Connect
            </button>
          )}
        </div>
      </div>

      {!isConnected && (
        <div className="mt-2 ml-11">
          <a href={exchange.keyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
            Create API key at {exchange.domain}
          </a>
        </div>
      )}
    </div>
  )
}

export function AddExchangeDialog({
  activeExchange, exchangeApiKey, setExchangeApiKey,
  exchangeSecret, setExchangeSecret, exchangePassphrase, setExchangePassphrase,
  exchangeError, isPending, onSubmit, onClose,
}: {
  activeExchange: (typeof SUPPORTED_EXCHANGES)[number]
  exchangeApiKey: string
  setExchangeApiKey: (v: string) => void
  exchangeSecret: string
  setExchangeSecret: (v: string) => void
  exchangePassphrase: string
  setExchangePassphrase: (v: string) => void
  exchangeError: string
  isPending: boolean
  onSubmit: () => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-card-border w-full max-w-lg rounded-xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={getExchangeLogoUrl(activeExchange.domain)} alt={activeExchange.label} width={24} height={24} className="rounded" />
            <h2 className="text-foreground text-base font-semibold">Connect {activeExchange.label}</h2>
          </div>
          <button onClick={onClose} className="text-foreground-muted hover:text-foreground transition-colors">
            <span className="material-symbols-rounded">close</span>
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="bg-warning/5 border border-warning/20 rounded-lg px-4 py-3">
            <div className="flex items-start gap-2.5">
              <span className="material-symbols-rounded text-warning text-sm mt-0.5">shield</span>
              <p className="text-xs text-warning">
                Only use <strong>read-only</strong> API keys. Never enable withdrawal or trading permissions.
              </p>
            </div>
          </div>
          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">API Key</label>
            <input
              type="text"
              value={exchangeApiKey}
              onChange={(e) => setExchangeApiKey(e.target.value)}
              placeholder={activeExchange.pemSecret ? "organizations/xxx/apiKeys/xxx" : "Paste your API key..."}
              className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2 px-3 text-foreground placeholder-foreground-muted/40 transition-colors text-sm font-mono"
            />
          </div>
          <div>
            <label className="block mb-2 text-foreground-muted text-xs font-semibold">API Secret</label>
            {activeExchange.pemSecret ? (
              <>
                <textarea
                  value={exchangeSecret}
                  onChange={(e) => setExchangeSecret(e.target.value)}
                  placeholder={"-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"}
                  rows={4}
                  className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2 px-3 text-foreground placeholder-foreground-muted/40 transition-colors text-sm font-mono resize-none"
                />
                <p className="mt-1 text-foreground-muted text-[10px]">
                  Paste the full private key including -----BEGIN/END EC PRIVATE KEY----- lines
                </p>
              </>
            ) : (
              <input
                type="password"
                value={exchangeSecret}
                onChange={(e) => setExchangeSecret(e.target.value)}
                placeholder="Paste your API secret..."
                className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2 px-3 text-foreground placeholder-foreground-muted/40 transition-colors text-sm font-mono"
              />
            )}
          </div>
          {activeExchange.requiresPassphrase && (
            <div>
              <label className="block mb-2 text-foreground-muted text-xs font-semibold">Passphrase</label>
              <input
                type="password"
                value={exchangePassphrase}
                onChange={(e) => setExchangePassphrase(e.target.value)}
                placeholder="Paste your API passphrase..."
                className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2 px-3 text-foreground placeholder-foreground-muted/40 transition-colors text-sm font-mono"
              />
            </div>
          )}
          {exchangeError && <p className="text-error text-xs">{exchangeError}</p>}
          <p className="text-foreground-muted text-xs">
            Create an API key at{" "}
            <a href={activeExchange.keyUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              {activeExchange.domain}
            </a>
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border border-card-border rounded-lg text-foreground-muted hover:text-foreground hover:border-card-border-hover transition-colors text-sm">
              Cancel
            </button>
            <button onClick={onSubmit} disabled={isPending} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm font-semibold">
              {isPending ? "Connecting..." : "Connect Exchange"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
