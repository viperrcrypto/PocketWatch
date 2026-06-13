"use client"

import { useState, useCallback } from "react"
import { useTravelCredentials, useSaveTravelCredential, useDeleteTravelCredential } from "@/hooks/travel"
import { toast } from "sonner"
import { CredentialCard } from "./credential-card"
import { TravelerProfileCard } from "./traveler-profile-card"

export function TravelSettingsForm() {
  const { data, isLoading } = useTravelCredentials()
  const saveMutation = useSaveTravelCredential()
  const deleteMutation = useDeleteTravelCredential()

  const [roameSession, setRoameSession] = useState("")
  const [serpApiKey, setSerpApiKey] = useState("")
  const [atfApiKey, setAtfApiKey] = useState("")
  const [refreshToken, setRefreshToken] = useState("")
  const [pointmeToken, setPointmeToken] = useState("")

  const POINTME_SCRIPT = `copy(JSON.stringify(await(await fetch('/api/auth/session')).json()))`

  const handleCopyScript = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(POINTME_SCRIPT)
      toast.success("Script copied — paste it in the point.me browser console")
    } catch {
      toast.error("Failed to copy — manually copy the script shown above")
    }
  }, [POINTME_SCRIPT])

  const roameCred = data?.services.find(s => s.service === "roame")
  const serpApiCred = data?.services.find(s => s.service === "serpapi")
  const atfCred = data?.services.find(s => s.service === "atf")
  const atfOauthCred = data?.services.find(s => s.service === "atf_oauth")
  const refreshCred = data?.services.find(s => s.service === "roame_refresh")
  const pointmeCred = data?.services.find(s => s.service === "pointme")

  const save = async (service: "roame" | "serpapi" | "atf" | "roame_refresh" | "pointme", key: string, label: string, reset: () => void) => {
    if (!key.trim()) return
    try {
      await saveMutation.mutateAsync({ service, key: key.trim() })
      reset()
      toast.success(`${label} saved`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  const handlePasteConnect = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        toast.error("Clipboard is empty — click the bookmarklet on point.me first")
        return
      }
      await saveMutation.mutateAsync({ service: "pointme", key: text.trim() })
      toast.success("point.me connected — token will auto-refresh")
    } catch (err) {
      const msg = (err as Error).message
      if (msg.includes("clipboard") || msg.includes("permission")) {
        toast.error("Clipboard access denied — paste manually instead")
      } else {
        toast.error(msg)
      }
    }
  }

  const handleDelete = async (service: "roame" | "serpapi" | "atf" | "roame_refresh" | "pointme" | "atf_oauth") => {
    try {
      await deleteMutation.mutateAsync(service)
      const names: Record<string, string> = { roame: "Roame", serpapi: "SerpAPI", atf: "ATF", roame_refresh: "Roame refresh token", pointme: "point.me", atf_oauth: "ATF (OAuth)" }
      toast.success(`${names[service] || service} credential removed`)
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (isLoading) {
    return (
      <div className="card p-6 text-center">
        <span className="material-symbols-rounded animate-spin text-foreground-muted" style={{ fontSize: 24 }}>
          progress_activity
        </span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TravelerProfileCard />

      <CredentialCard
        icon="key"
        title="Roame Session"
        credential={roameCred}
        description={
          <>
            Searches 19+ award programs in one API call.{" "}
            <a href="https://roame.travel" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Sign up free</a>
            {" → "}login → open DevTools (F12) → Application → IndexedDB → <code className="text-[10px] bg-card-border/50 px-1 rounded">firebaseLocalStorageDb</code> → <code className="text-[10px] bg-card-border/50 px-1 rounded">firebaseLocalStorage</code> → click the <code className="text-[10px] bg-card-border/50 px-1 rounded">firebase:authUser:…</code> row and paste whatever you copy here (the value object, or even the raw console output — we&apos;ll find the tokens). Capturing it includes the refresh token, so the session auto-renews.
          </>
        }
        inputType="textarea"
        rows={3}
        inputValue={roameSession}
        onInputChange={setRoameSession}
        placeholder="Paste the firebase:authUser value (any format) — or a raw ID token (eyJ...)"
        onSave={() => save("roame", roameSession, "Roame session", () => setRoameSession(""))}
        onDelete={() => handleDelete("roame")}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        saveLabel="Save Session"
      />

      <CredentialCard
        icon="search"
        title="SerpAPI Key"
        credential={serpApiCred}
        description={
          <>
            Google Flights cash prices + hotel search via SerpAPI. 100 free searches/month.{" "}
            <a href="https://serpapi.com/manage-api-key" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Get a key
            </a>
          </>
        }
        inputValue={serpApiKey}
        onInputChange={setSerpApiKey}
        placeholder="Enter SerpAPI key"
        onSave={() => save("serpapi", serpApiKey, "SerpAPI key", () => setSerpApiKey(""))}
        onDelete={() => handleDelete("serpapi")}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />

      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>airplane_ticket</span>
            <h3 className="text-sm font-bold text-foreground">Award Travel Finder (OAuth)</h3>
          </div>
          {atfOauthCred && (
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
              Connected
            </span>
          )}
        </div>
        <p className="text-xs text-foreground-muted">
          Searches all airlines for award availability in one call. Requires an ATF{" "}
          <strong>Premium</strong> plan. One-time connect: sign in to ATF and authorize PocketWatch.
        </p>
        {atfOauthCred ? (
          <div className="bg-background rounded-lg p-3 border border-card-border flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-foreground font-medium">Account connected</p>
              <p className="text-[10px] text-foreground-muted mt-0.5">
                Connected {new Date(atfOauthCred.updatedAt).toLocaleDateString()} — token auto-refreshes
              </p>
            </div>
            <button
              onClick={() => handleDelete("atf_oauth")}
              disabled={deleteMutation.isPending}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {deleteMutation.isPending ? "Disconnecting…" : "Disconnect"}
            </button>
          </div>
        ) : (
          <a
            href="/api/travel/atf/connect"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium btn-primary transition-colors w-fit"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>link</span>
            Connect ATF (OAuth)
          </a>
        )}
      </div>

      <CredentialCard
        icon="flight"
        title="Award Travel Finder (ATF)"
        credential={atfCred}
        description={
          <>
            Searches 22 airlines for award availability (150 calls/month).{" "}
            <a href="https://awardtravelfinder.com/api" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Get API key
            </a>
            {" "}— sign up, go to API settings, and copy your key.
          </>
        }
        inputValue={atfApiKey}
        onInputChange={setAtfApiKey}
        placeholder="Enter ATF API key"
        onSave={() => save("atf", atfApiKey, "ATF API key", () => setAtfApiKey(""))}
        onDelete={() => handleDelete("atf")}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />

      <CredentialCard
        icon="travel_explore"
        title="point.me"
        badge={pointmeCred ? "Auto-refresh enabled" : undefined}
        credential={pointmeCred}
        description={
          <>
            Searches all major airline programs with real-time availability.{" "}
            <a href="https://point.me" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Login to point.me</a>
            {" → "}open Console (F12) → click{" "}
            <button
              type="button"
              onClick={handleCopyScript}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded-full border border-primary/30 hover:bg-primary/30 transition-colors cursor-pointer"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 12 }}>content_copy</span>
              Copy Script
            </button>
            {" → paste in console → Enter → come back → "}
            <strong>Paste & Connect</strong>. Token auto-refreshes.
          </>
        }
        inputType="textarea"
        rows={3}
        inputValue={pointmeToken}
        onInputChange={setPointmeToken}
        placeholder='Paste session JSON or raw JWT — or use "Paste & Connect" after clicking the bookmarklet'
        onSave={() => save("pointme", pointmeToken, "point.me connected — token will auto-refresh", () => setPointmeToken(""))}
        onDelete={() => handleDelete("pointme")}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        saveLabel="Save Session"
        secondaryAction={{ label: "Paste & Connect", onClick: handlePasteConnect }}
      />

      <CredentialCard
        icon="autorenew"
        title="Roame Auto-Refresh"
        badge="Auto-refresh enabled"
        credential={refreshCred}
        description={
          <>
            Optional — the <strong>Roame Session</strong> field above already captures this automatically when you paste the <code className="text-[10px] bg-card-border/50 px-1 rounded">firebase:authUser</code> value. You can also paste that same value (or just the <code className="text-[10px] bg-card-border/50 px-1 rounded">refreshToken</code>) here — we&apos;ll pull the token out either way.
          </>
        }
        inputType="textarea"
        rows={2}
        inputValue={refreshToken}
        onInputChange={setRefreshToken}
        placeholder="Paste the firebase:authUser value or the refresh token"
        onSave={() => save("roame_refresh", refreshToken, "Roame refresh token — sessions will auto-renew", () => setRefreshToken(""))}
        onDelete={() => handleDelete("roame_refresh")}
        isSaving={saveMutation.isPending}
        isDeleting={deleteMutation.isPending}
        saveLabel="Save Token"
      />
    </div>
  )
}
