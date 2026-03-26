"use client"

import { useState, useEffect, useCallback } from "react"
import { CollapsibleSection } from "./collapsible-section"
import { usePasskey } from "@/hooks/use-passkey"

interface PasskeyEntry {
  id: string
  name: string
  createdAt: string
  lastUsedAt: string | null
}

export function PasskeySection() {
  const [passkeys, setPasskeys] = useState<PasskeyEntry[]>([])
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { supported, loading: registering, register } = usePasskey()

  const loadPasskeys = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/passkey", { credentials: "include" })
      if (!res.ok) { setFetchError("Failed to load passkeys"); return }
      const data = await res.json()
      setPasskeys(data.passkeys ?? [])
      setFetchError(null)
    } catch {
      setFetchError("Failed to load passkeys")
    }
  }, [])

  useEffect(() => { loadPasskeys() }, [loadPasskeys])

  async function handleRegister() {
    setActionError(null)
    setSuccess(null)
    const result = await register()
    if (result.ok) {
      setSuccess("Passkey registered successfully")
      loadPasskeys()
    } else if (result.error) {
      setActionError(result.error)
    }
  }

  async function handleRename(id: string) {
    if (!editName.trim()) return
    setActionError(null)
    setSuccess(null)
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: editName.trim() }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setActionError(data?.error ?? "Failed to rename passkey")
        return
      }
      setEditingId(null)
      setEditName("")
      setSuccess("Passkey renamed")
      loadPasskeys()
    } catch {
      setActionError("Failed to rename passkey")
    }
  }

  async function handleDelete(id: string) {
    setActionError(null)
    setSuccess(null)
    setDeletingId(id)
    try {
      const res = await fetch(`/api/auth/passkey/${id}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setActionError(data?.error ?? "Failed to delete passkey")
        return
      }
      setSuccess("Passkey deleted")
      loadPasskeys()
    } catch {
      setActionError("Failed to delete passkey")
    } finally {
      setDeletingId(null)
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    })
  }

  return (
    <CollapsibleSection
      title="Passkeys"
      subtitle="Use biometrics or security keys to unlock your vault"
      actions={
        supported ? (
          <button
            onClick={handleRegister}
            disabled={registering}
            className="px-3 py-1.5 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
          >
            {registering ? "Registering..." : "Add Passkey"}
          </button>
        ) : undefined
      }
    >
      <div className="p-5 space-y-4">
        {!supported && (
          <p className="text-xs text-foreground-muted">
            Your browser does not support passkeys (WebAuthn).
          </p>
        )}

        {fetchError && <p className="text-xs text-error">{fetchError}</p>}
        {actionError && <p className="text-xs text-error">{actionError}</p>}
        {success && (
          <span className="flex items-center gap-1.5 text-success">
            <span className="material-symbols-rounded text-sm">check_circle</span>
            <span className="text-xs font-medium">{success}</span>
          </span>
        )}

        {passkeys.length === 0 && !fetchError && (
          <p className="text-xs text-foreground-muted">
            No passkeys registered yet. Add one to unlock with Face ID, Touch ID, or a security key.
          </p>
        )}

        {passkeys.length > 0 && (
          <div className="space-y-2">
            {passkeys.map((pk) => (
              <div
                key={pk.id}
                className="flex items-center justify-between gap-3 p-3 bg-background rounded-lg border border-card-border"
              >
                {editingId === pk.id ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleRename(pk.id); if (e.key === "Escape") setEditingId(null) }}
                      autoFocus
                      className="flex-1 min-w-0 bg-transparent border border-card-border rounded px-2 py-1 text-sm text-foreground outline-none focus:border-primary"
                    />
                    <button onClick={() => handleRename(pk.id)} className="text-xs font-medium text-primary hover:text-primary-hover">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-foreground-muted hover:text-foreground">Cancel</button>
                  </div>
                ) : (
                  <>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-rounded text-base text-foreground-muted">passkey</span>
                        <span className="text-sm font-medium text-foreground truncate">{pk.name}</span>
                      </div>
                      <p className="text-xs text-foreground-muted mt-0.5 ml-6">
                        Added {formatDate(pk.createdAt)}
                        {pk.lastUsedAt && <> &middot; Last used {formatDate(pk.lastUsedAt)}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => { setEditingId(pk.id); setEditName(pk.name) }}
                        className="p-1.5 text-foreground-muted hover:text-foreground rounded transition-colors"
                        title="Rename"
                      >
                        <span className="material-symbols-rounded text-base">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(pk.id)}
                        disabled={deletingId === pk.id}
                        className="p-1.5 text-foreground-muted hover:text-error rounded transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <span className="material-symbols-rounded text-base">delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </CollapsibleSection>
  )
}
