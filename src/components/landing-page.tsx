"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"

export function LandingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"loading" | "setup" | "unlock">("loading")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => setMode(data.initialized ? "unlock" : "setup"))
      .catch(() => setMode("setup"))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === "setup") {
      if (password.length < 8) {
        setError("Password must be at least 8 characters.")
        return
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.")
        return
      }
    }

    setLoading(true)
    try {
      const endpoint = mode === "setup" ? "/api/auth/setup" : "/api/auth/unlock"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Something went wrong")
        return
      }

      router.push("/portfolio")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/auth/reset", { method: "POST" })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Reset failed")
        return
      }
      setMode("setup")
      setPassword("")
      setConfirmPassword("")
      setShowReset(false)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-foreground-muted text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="pw-landing" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#22d3ee"/>
              </linearGradient>
            </defs>
            {/* Chain/ring */}
            <path d="M12 1.5v2" stroke="url(#pw-landing)" strokeWidth="1.8" strokeLinecap="round"/>
            <circle cx="12" cy="1.8" r="1" fill="none" stroke="url(#pw-landing)" strokeWidth="0.8"/>
            {/* Watch body */}
            <circle cx="12" cy="13" r="9.5" fill="url(#pw-landing)"/>
            {/* Inner face */}
            <circle cx="12" cy="13" r="7.5" fill="none" stroke="white" strokeWidth="0.8" opacity="0.3"/>
            {/* Hour hand */}
            <line x1="12" y1="13" x2="12" y2="8.5" stroke="white" strokeWidth="1.6" strokeLinecap="round"/>
            {/* Minute hand */}
            <line x1="12" y1="13" x2="16" y2="13" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
            {/* Center dot */}
            <circle cx="12" cy="13" r="1" fill="white"/>
            {/* Hour markers */}
            <circle cx="12" cy="6.5" r="0.6" fill="white" opacity="0.5"/>
            <circle cx="18.5" cy="13" r="0.6" fill="white" opacity="0.5"/>
            <circle cx="12" cy="19.5" r="0.6" fill="white" opacity="0.5"/>
            <circle cx="5.5" cy="13" r="0.6" fill="white" opacity="0.5"/>
          </svg>
          <span className="text-2xl font-semibold tracking-wide text-foreground">
            Pocket<span className="font-normal">Watch</span>
          </span>
        </div>

        <p className="text-foreground-muted text-sm text-center">
          {mode === "setup"
            ? "Set a password to secure your vault. If you forget it, your data cannot be recovered."
            : "Enter your password to unlock."}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-foreground-muted mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "setup" ? "Min 8 characters" : "Enter your password"}
              autoComplete={mode === "setup" ? "new-password" : "current-password"}
              autoFocus
              required
              className="w-full px-4 py-3 text-sm bg-card border border-card-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-foreground-muted"
            />
          </div>

          {mode === "setup" && (
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-medium text-foreground-muted mb-1.5">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                required
                className="w-full px-4 py-3 text-sm bg-card border border-card-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-foreground-muted"
              />
            </div>
          )}

          {error && (
            <div className="text-sm text-error bg-error-muted px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-6 py-3 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {loading
              ? "Please wait..."
              : mode === "setup"
                ? "Create Vault"
                : "Unlock"}
          </button>
        </form>

        {/* Reset option (only on unlock screen) */}
        {mode === "unlock" && !showReset && (
          <button
            type="button"
            onClick={() => setShowReset(true)}
            className="text-xs text-foreground-muted hover:text-foreground transition-colors"
          >
            Forgot password? Reset vault
          </button>
        )}

        {showReset && (
          <div className="w-full p-4 bg-error-muted border border-error/20 rounded-lg space-y-3">
            <p className="text-sm text-error font-medium">
              This will permanently delete all your data.
            </p>
            <p className="text-xs text-foreground-muted">
              All wallets, transactions, settings, and encrypted data will be wiped. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex-1 px-4 py-2 text-sm font-medium bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {loading ? "Wiping..." : "Wipe Everything"}
              </button>
              <button
                onClick={() => setShowReset(false)}
                className="flex-1 px-4 py-2 text-sm font-medium bg-card border border-card-border rounded-lg hover:bg-card-hover transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {mode === "setup" && (
          <p className="text-xs text-foreground-muted/60 text-center">
            Your password derives the encryption key for all data. There is no recovery — if you forget it, reset wipes everything.
          </p>
        )}
      </div>
    </div>
  )
}
