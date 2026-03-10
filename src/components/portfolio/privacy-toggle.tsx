"use client"

interface PrivacyToggleProps {
  isHidden: boolean
  onToggle: () => void
}

export function PrivacyToggle({ isHidden, onToggle }: PrivacyToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center justify-center w-8 h-8 text-foreground-muted hover:text-foreground transition-colors rounded-lg"
      title={isHidden ? "Show balances" : "Hide balances"}
      aria-label={isHidden ? "Show balances" : "Hide balances"}
    >
      <span className="material-symbols-rounded text-lg">
        {isHidden ? "visibility_off" : "visibility"}
      </span>
    </button>
  )
}
