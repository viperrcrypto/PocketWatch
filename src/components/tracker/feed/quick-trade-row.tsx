"use client"

import type { TrackerChain } from "@/lib/tracker/types"
import { getTradeLinks } from "@/lib/tracker/links"

interface QuickTradeRowProps {
  chain: TrackerChain
  tokenAddress: string
}

export default function QuickTradeRow({ chain, tokenAddress }: QuickTradeRowProps) {
  const links = getTradeLinks(chain, tokenAddress)

  if (links.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-foreground-muted mr-1">
        Trade
      </span>
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider
            bg-background border border-card-border text-warning
            hover:border-warning hover:text-foreground transition-colors"
          style={{ borderRadius: 0 }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 12 }}>
            bolt
          </span>
          {link.name}
        </a>
      ))}
    </div>
  )
}
