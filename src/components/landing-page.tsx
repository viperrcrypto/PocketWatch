"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

export function LandingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<"loading" | "setup" | "unlock" | "restore">("loading")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoreKeysChanged, setRestoreKeysChanged] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/auth/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setMode(data.initialized ? "unlock" : "setup"))
      .catch((err) => {
        if (!controller.signal.aborted) setMode("setup")
      })
    return () => controller.abort()
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

      // Clear the auth redirect flag so future 401s can trigger a redirect again
      if (typeof window !== "undefined") sessionStorage.removeItem("__pw_auth_redirect")
      // Redirect to the page they were trying to visit, or default to portfolio
      const rawRedirect = searchParams.get("redirect") ?? ""
      const redirectTo = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/net-worth"
      router.push(redirectTo)
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

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault()
    if (!restoreFile || !password) return
    setError(null)
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", restoreFile)
      formData.append("password", password)
      const res = await fetch("/api/backup/import", { method: "POST", body: formData })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Restore failed"); return }
      if (typeof window !== "undefined") sessionStorage.removeItem("__pw_auth_redirect")
      if (data.keysChanged) {
        setRestoreKeysChanged(true)
        return
      }
      router.push("/net-worth")
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
          <svg width="36" height="36" viewBox="0 0 16 16" fill="currentColor" className="text-foreground" aria-hidden="true">
            <path d="M3 2.5A1.5 1.5 0 0 1 4.5 1h1A1.5 1.5 0 0 1 7 2.5V5h2V2.5A1.5 1.5 0 0 1 10.5 1h1A1.5 1.5 0 0 1 13 2.5v2.382a.5.5 0 0 0 .276.447l.895.447A1.5 1.5 0 0 1 15 7.118V14.5a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 14.5v-3a.5.5 0 0 1 .146-.354l.854-.853V9.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5v.793l.854.853A.5.5 0 0 1 7 11.5v3A1.5 1.5 0 0 1 5.5 16h-3A1.5 1.5 0 0 1 1 14.5V7.118a1.5 1.5 0 0 1 .83-1.342l.894-.447A.5.5 0 0 0 3 4.882zM4.5 2a.5.5 0 0 0-.5.5V3h2v-.5a.5.5 0 0 0-.5-.5zM6 4H4v.882a1.5 1.5 0 0 1-.83 1.342l-.894.447A.5.5 0 0 0 2 7.118V13h4v-1.293l-.854-.853A.5.5 0 0 1 5 10.5v-1A1.5 1.5 0 0 1 6.5 8h3A1.5 1.5 0 0 1 11 9.5v1a.5.5 0 0 1-.146.354l-.854.853V13h4V7.118a.5.5 0 0 0-.276-.447l-.895-.447A1.5 1.5 0 0 1 12 4.882V4h-2v1.5a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5zm4-1h2v-.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5zm4 11h-4v.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5zm-8 0H2v.5a.5.5 0 0 0 .5.5h3a.5.5 0 0 0 .5-.5z"/>
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
          <>
            <p className="text-xs text-foreground-muted/60 text-center">
              Your password derives the encryption key for all data. There is no recovery — if you forget it, reset wipes everything.
            </p>
            <button
              type="button"
              onClick={() => { setMode("restore"); setError(null); setPassword("") }}
              className="text-xs text-primary hover:text-primary-hover transition-colors"
            >
              Restore from backup instead
            </button>
          </>
        )}

        {mode === "restore" && (restoreKeysChanged ? (
          <div className="w-full space-y-4">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-2">
              <p className="text-sm font-semibold text-foreground">Restore complete — update your .env</p>
              <p className="text-xs text-foreground-muted">
                Copy the ENCRYPTION_KEY and FINANCE_ENCRYPTION_KEY from your original .env to this server and restart.
              </p>
            </div>
            <button onClick={() => router.push("/net-worth")} className="w-full px-6 py-3 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors">
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <form onSubmit={handleRestore} className="w-full space-y-4">
            <p className="text-sm text-foreground-muted text-center">Upload a .pwbackup file and enter the vault password used when it was created.</p>
            <input type="file" accept=".pwbackup" onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)} className="w-full text-sm text-foreground-muted file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border file:border-card-border file:bg-card file:text-sm file:text-foreground file:font-medium hover:file:bg-card-hover file:cursor-pointer file:transition-colors" />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Vault password" required className="w-full px-4 py-3 text-sm bg-card border border-card-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-foreground-muted" />
            {error && <div className="text-sm text-error bg-error-muted px-4 py-2 rounded-lg">{error}</div>}
            <button type="submit" disabled={loading || !restoreFile || !password} className="w-full px-6 py-3 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50">
              {loading ? "Restoring..." : "Restore Backup"}
            </button>
            <button type="button" onClick={() => { setMode("setup"); setError(null); setPassword(""); setRestoreFile(null) }} className="w-full text-xs text-foreground-muted hover:text-foreground transition-colors text-center">Back to setup</button>
          </form>
        ))}
      </div>
    </div>
  )
}
