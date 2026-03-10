"use client"

import { useState } from "react"
import { CollapsibleSection } from "./collapsible-section"

export function PasswordChangeSection() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isPending, setIsPending] = useState(false)

  const handleChangePassword = async () => {
    setError(null)
    setSuccess(false)

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords don't match.")
      return
    }

    setIsPending(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || "Password change failed.")
        return
      }

      setSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <CollapsibleSection
      title="Security"
      subtitle="Change your account password"
    >
      <div className="p-5 space-y-4 max-w-md">
        <div>
          <label className="block mb-1.5 text-xs font-semibold text-foreground-muted">
            Current Password
          </label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2.5 px-3 text-foreground transition-colors text-sm"
            autoComplete="current-password"
          />
        </div>

        <div>
          <label className="block mb-1.5 text-xs font-semibold text-foreground-muted">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2.5 px-3 text-foreground transition-colors text-sm"
            autoComplete="new-password"
          />
        </div>

        <div>
          <label className="block mb-1.5 text-xs font-semibold text-foreground-muted">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-transparent border border-card-border rounded-lg focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none py-2.5 px-3 text-foreground transition-colors text-sm"
            autoComplete="new-password"
          />
        </div>

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={handleChangePassword}
            disabled={isPending || !currentPassword || !newPassword || !confirmPassword}
            className="px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 text-sm font-semibold"
          >
            {isPending ? "Changing..." : "Change Password"}
          </button>

          {success && (
            <span className="flex items-center gap-1.5 text-success">
              <span className="material-symbols-rounded text-sm">check_circle</span>
              <span className="text-xs font-medium">Password changed successfully</span>
            </span>
          )}
        </div>

        {error && (
          <p className="text-error text-xs">{error}</p>
        )}
      </div>
    </CollapsibleSection>
  )
}
