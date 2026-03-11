"use client"

import { useState } from "react"

interface SimpleFINConnectProps {
  onConnect: (setupToken: string) => Promise<void>
  isLoading?: boolean
  className?: string
  buttonLabel?: string
}

export function SimpleFINConnect({ onConnect, isLoading, className, buttonLabel = "Connect with SimpleFIN" }: SimpleFINConnectProps) {
  const [token, setToken] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    const setupToken = token.trim()
    if (!setupToken || isLoading) return

    setError("")
    try {
      await onConnect(setupToken)
      setIsOpen(false)
      setToken("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect SimpleFIN")
    }
  }

  const isCompact = !!className

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={className ?? "btn-secondary flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"}
      >
        <span className="material-symbols-rounded" style={{ fontSize: isCompact ? 14 : 18 }}>link</span>
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-card-border shadow-lg max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Connect via SimpleFIN</h3>
              <button
                onClick={() => {
                  setIsOpen(false)
                  setError("")
                }}
                className="text-foreground-muted hover:text-foreground"
              >
                <span className="material-symbols-rounded">close</span>
              </button>
            </div>

            <div className="text-sm text-foreground-muted space-y-2">
              <p>1. Go to <a href="https://beta-bridge.simplefin.org/simplefin/create" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">simplefin.org</a> and create a Setup Token</p>
              <p>2. Paste the token below to connect your bank accounts</p>
              <p className="text-xs text-foreground-muted/70">SimpleFIN costs $15/year and supports most US banks.</p>
            </div>

            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste your Setup Token here..."
              className="w-full px-3 py-2.5 rounded-lg bg-background-secondary border border-card-border text-sm text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />

            {error && (
              <p className="text-xs text-error">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setError("")
                }}
                className="btn-ghost px-4 py-2 rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!token.trim() || isLoading}
                className="btn-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {isLoading ? "Connecting..." : "Connect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
