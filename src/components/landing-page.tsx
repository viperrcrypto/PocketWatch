"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function LandingPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"login" | "register">("login")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-8 max-w-sm w-full">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <defs>
              <linearGradient id="wt-landing" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#6366f1"/>
                <stop offset="100%" stopColor="#22d3ee"/>
              </linearGradient>
            </defs>
            <rect x="1" y="1" width="22" height="22" rx="6" fill="url(#wt-landing)"/>
            <polyline points="4.5,16 8,9 12,14 16,7 19.5,4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <polyline points="16.5,4 19.5,4 19.5,7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <line x1="4.5" y1="19.5" x2="19.5" y2="19.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
          </svg>
          <span className="text-2xl font-semibold tracking-wide text-foreground">
            Wealth<span className="font-normal">Tracker</span>
          </span>
        </div>

        <p className="text-foreground-muted text-sm text-center">
          {mode === "login"
            ? "Sign in to access your portfolio dashboard."
            : "Create an account to get started."}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="w-full space-y-4">
          <div>
            <label htmlFor="username" className="block text-xs font-medium text-foreground-muted mb-1.5">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="your_username"
              autoComplete="username"
              required
              className="w-full px-4 py-3 text-sm bg-card border border-card-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-foreground-muted"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-foreground-muted mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "register" ? "Min 8 characters" : "Enter your password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              className="w-full px-4 py-3 text-sm bg-card border border-card-border rounded-lg outline-none focus:border-primary transition-colors placeholder:text-foreground-muted"
            />
          </div>

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
              : mode === "login"
                ? "Sign In"
                : "Create Account"}
          </button>
        </form>

        {/* Toggle */}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login")
            setError(null)
          }}
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          {mode === "login"
            ? "Don't have an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  )
}
