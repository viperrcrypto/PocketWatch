"use client"

import type { TrackerChain } from "@/lib/tracker/types"
import { getChartLinks } from "@/lib/tracker/links"

interface QuickLinksRowProps {
  chain: TrackerChain
  tokenAddress: string
}

export default function QuickLinksRow({ chain, tokenAddress }: QuickLinksRowProps) {
  const links = getChartLinks(chain, tokenAddress)

  if (links.length === 0) return null

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-widest text-foreground-muted mr-1">
        Charts
      </span>
      {links.map((link) => (
        <a
          key={link.name}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center px-2 py-1 text-[10px] font-semibold uppercase tracking-wider
            bg-background border border-card-border text-foreground-muted
            hover:border-card-border-hover hover:text-foreground transition-colors"
          style={{ borderRadius: 0 }}
        >
          {link.name}
        </a>
      ))}
    </div>
  )
}
