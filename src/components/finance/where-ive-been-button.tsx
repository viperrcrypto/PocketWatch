"use client"

import { useState } from "react"
import dynamic from "next/dynamic"

const WhereIveBeenModal = dynamic(
  () => import("./where-ive-been-modal").then((m) => m.WhereIveBeenModal),
  { ssr: false }
)

export function WhereIveBeenButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-card-border text-foreground-muted hover:text-foreground hover:bg-background-secondary transition-colors"
        title="Where I've Been"
      >
        <span className="material-symbols-rounded" style={{ fontSize: 15 }}>public</span>
        Map
      </button>
      {open && <WhereIveBeenModal open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
