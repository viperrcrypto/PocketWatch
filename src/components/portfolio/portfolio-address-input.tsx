"use client"

import { cn } from "@/lib/utils"

interface PortfolioAddressInputProps {
  value: string
  onChange: (v: string) => void
  chain?: string
  placeholder?: string
  error?: string
}

export function PortfolioAddressInput({
  value,
  onChange,
  chain,
  placeholder = "Enter address...",
  error,
}: PortfolioAddressInputProps) {
  return (
    <div className="w-full">
      <div className="flex items-center gap-2">
        {/* Chain badge */}
        {chain && (
          <span className="inline-flex items-center px-2 py-1 bg-card-elevated border border-card-border rounded-md font-data text-[10px] font-semibold uppercase tracking-wide text-foreground-muted flex-shrink-0">
            {chain}
          </span>
        )}

        {/* Input */}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            "w-full bg-transparent border-0 border-b font-data text-sm text-foreground",
            "px-0 py-2 focus:outline-none transition-colors",
            "placeholder:text-foreground-muted",
            error
              ? "border-b-error focus:border-b-error"
              : "border-b-card-border focus:border-b-primary"
          )}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1.5 text-[11px] text-error">
          {error}
        </p>
      )}
    </div>
  )
}
