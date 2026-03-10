"use client"

import { useState, useMemo } from "react"
import { PortfolioDataTable } from "@/components/portfolio/portfolio-data-table"
import { getAirdropColumns } from "./airdrops-columns"
import type { AirdropResult } from "@/lib/portfolio/airdrop-types"

interface AirdropsDepletedSectionProps {
  items: AirdropResult[]
}

export function AirdropsDepletedSection({ items }: AirdropsDepletedSectionProps) {
  const [isOpen, setIsOpen] = useState(false)
  const columns = useMemo(() => getAirdropColumns("vesting"), [])

  if (items.length === 0) return null

  return (
    <div className="opacity-50 hover:opacity-70 transition-opacity">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 w-full px-4 py-3 bg-card border border-card-border rounded-xl text-sm text-foreground-muted hover:text-foreground transition-colors"
      >
        <span
          className="material-symbols-rounded transition-transform"
          style={{ fontSize: 18, transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          expand_more
        </span>
        <span className="font-semibold">Depleted Streams</span>
        <span className="text-xs bg-foreground-muted/10 px-2 py-0.5 rounded-full">
          {items.length}
        </span>
      </button>

      {isOpen && (
        <div className="mt-2">
          <PortfolioDataTable
            columns={columns}
            data={items}
            isLoading={false}
            emptyMessage="No depleted streams"
            emptyIcon="lock_clock"
          />
        </div>
      )}
    </div>
  )
}
