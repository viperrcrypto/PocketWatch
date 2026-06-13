"use client"

import type { TravelCredentialInfo } from "@/types/travel"
import { cn } from "@/lib/utils"

interface CredentialCardProps {
  icon: string
  title: string
  badge?: string
  description: React.ReactNode
  credential: TravelCredentialInfo | undefined
  // Input mode
  inputValue: string
  onInputChange: (value: string) => void
  placeholder: string
  inputType?: "text" | "textarea"
  rows?: number
  // Actions
  onSave: () => void
  onDelete: () => void
  isSaving: boolean
  isDeleting: boolean
  saveLabel?: string
  // Optional secondary action (e.g. "Paste & Connect")
  secondaryAction?: { label: string; onClick: () => void }
}

export function CredentialCard({
  icon, title, badge, description, credential,
  inputValue, onInputChange, placeholder, inputType = "text", rows = 1,
  onSave, onDelete, isSaving, isDeleting, saveLabel = "Save", secondaryAction,
}: CredentialCardProps) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-rounded text-primary" style={{ fontSize: 18 }}>{icon}</span>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
        </div>
        {credential && (
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
            {badge || "Connected"}
          </span>
        )}
      </div>
      <p className="text-xs text-foreground-muted">{description}</p>

      {/* Configured-credential summary + Remove. */}
      {credential && (
        <div className="flex items-center justify-between bg-background rounded-lg p-3 border border-card-border">
          <div>
            <p className="text-xs text-foreground font-mono">{credential.maskedKey}</p>
            <p className="text-[10px] text-foreground-muted mt-0.5">
              Updated {new Date(credential.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Removing…" : "Remove"}
          </button>
        </div>
      )}

      {/* Input is ALWAYS rendered so a configured credential can be REPLACED
          in place (the save endpoint upserts) — not just removed-then-re-added. */}
      {credential && (
        <p className="text-[10px] text-foreground-muted">
          Paste a new value below to replace it.
        </p>
      )}
      {inputType === "textarea" ? (
        <div className="space-y-2">
          <textarea
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full bg-background border border-card-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              disabled={!inputValue.trim() || isSaving}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-medium transition-colors",
                inputValue.trim() ? "btn-primary" : "bg-card-border text-foreground-muted cursor-not-allowed",
              )}
            >
              {isSaving ? "Saving..." : credential ? "Update" : saveLabel}
            </button>
            {secondaryAction && (
              <button
                onClick={secondaryAction.onClick}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg text-xs font-medium btn-secondary transition-colors"
              >
                {secondaryAction.label}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder={placeholder}
            className="flex-1 bg-background border border-card-border rounded-lg px-3 py-2 text-xs font-mono text-foreground placeholder:text-foreground-muted/50 focus:outline-none focus:border-primary transition-colors"
          />
          <button
            onClick={onSave}
            disabled={!inputValue.trim() || isSaving}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-medium transition-colors",
              inputValue.trim() ? "btn-primary" : "bg-card-border text-foreground-muted cursor-not-allowed",
            )}
          >
            {isSaving ? "Saving..." : credential ? "Update" : saveLabel}
          </button>
        </div>
      )}
    </div>
  )
}
