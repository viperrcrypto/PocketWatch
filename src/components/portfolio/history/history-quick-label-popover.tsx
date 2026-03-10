"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { shortenAddress } from "@/lib/portfolio/utils"

export function QuickLabelPopover({
  address,
  currentName,
  anchorRect,
  onSave,
  onClose,
  isPending,
}: {
  address: string
  currentName?: string
  anchorRect: DOMRect
  onSave: (name: string) => void
  onClose: () => void
  isPending: boolean
}) {
  const [name, setName] = useState(currentName ?? "")
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [onClose])

  const handleCopyAddress = useCallback(() => {
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [address])

  const popoverWidth = 256 // w-64
  const top = anchorRect.bottom + 4
  const left = Math.min(
    Math.max(8, anchorRect.left - 40),
    window.innerWidth - popoverWidth - 8
  )

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-card border border-card-border rounded-xl shadow-lg p-3 w-64"
      style={{ top, left }}
    >
      <p className="text-[10px] font-medium tracking-wider text-foreground-muted mb-2">
        Label address
      </p>
      <button
        onClick={handleCopyAddress}
        className="flex items-center gap-1.5 w-full text-left group mb-2 cursor-pointer"
        title={`Click to copy: ${address}`}
      >
        <span className="text-xs text-foreground-muted font-data truncate flex-1">
          {shortenAddress(address, 8)}
        </span>
        <span className="material-symbols-rounded text-[13px] text-foreground-muted/50 group-hover:text-foreground transition-colors shrink-0">
          {copied ? "check" : "content_copy"}
        </span>
        {copied && (
          <span className="text-[9px] text-success font-medium shrink-0">Copied!</span>
        )}
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onSave(name.trim())
        }}
        className="flex flex-col gap-2"
      >
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Binance Hot Wallet"
          className="w-full bg-background border border-card-border-hover focus:border-foreground outline-none py-1.5 px-2 text-foreground text-xs rounded-lg"
        />
        <button
          type="submit"
          disabled={!name.trim() || isPending}
          className="btn-primary w-full py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
        >
          {isPending ? "..." : "Save"}
        </button>
      </form>
    </div>
  )
}
