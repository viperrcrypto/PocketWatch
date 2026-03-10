"use client"

import { useState, useRef, useEffect } from "react"

export function EditableName({
  value,
  onSave,
}: {
  value: string
  onSave: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== value) onSave(trimmed)
    else setDraft(value)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") { setDraft(value); setEditing(false) }
        }}
        className="text-sm font-medium text-foreground bg-transparent border-b border-primary outline-none py-0 px-0 min-w-0 w-full"
      />
    )
  }

  return (
    <div className="flex items-center gap-1.5 min-w-0 group">
      <span className="text-sm font-medium text-foreground truncate">{value}</span>
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true) }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-foreground-muted hover:text-foreground transition-opacity"
        title="Rename account"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>edit</span>
      </button>
    </div>
  )
}
