"use client"

import { useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import type { LocationPin } from "./where-ive-been-types"

function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ""
  return String.fromCodePoint(...Array.from(code.toUpperCase()).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

interface Props {
  locations: LocationPin[]
}

export function WhereIveBeenStats({ locations }: Props) {
  const byCountry = useMemo(() => {
    const map = new Map<string, { country: string; cities: LocationPin[]; totalSpent: number; totalTxns: number }>()
    for (const loc of locations) {
      const existing = map.get(loc.country)
      if (existing) {
        existing.cities.push(loc)
        existing.totalSpent += loc.totalSpent
        existing.totalTxns += loc.transactionCount
      } else {
        map.set(loc.country, { country: loc.country, cities: [loc], totalSpent: loc.totalSpent, totalTxns: loc.transactionCount })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .map((c) => ({ ...c, cities: c.cities.sort((a, b) => b.totalSpent - a.totalSpent) }))
  }, [locations])

  if (byCountry.length === 0) {
    return <div className="flex-1 flex items-center justify-center p-6"><p className="text-xs text-foreground-muted">No data</p></div>
  }

  return (
    <div className="overflow-y-auto flex-1">
      <div className="space-y-3 p-3">
        {byCountry.map((group) => (
          <div key={group.country} className="rounded-lg border border-card-border/50 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-background-secondary/30">
              <div className="flex items-center gap-2">
                <span className="text-base">{countryFlag(group.country)}</span>
                <span className="text-xs font-bold text-foreground">{group.country}</span>
                <span className="text-[9px] text-foreground-muted">{group.totalTxns} txns</span>
              </div>
              <span className="text-xs font-data font-bold tabular-nums text-primary">{formatCurrency(group.totalSpent)}</span>
            </div>
            <div className="divide-y divide-card-border/30">
              {group.cities.slice(0, 5).map((city) => (
                <div key={`${city.city}-${city.country}`} className="flex items-center justify-between px-3 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] text-foreground truncate">{city.city}</span>
                    {city.region && <span className="text-[9px] text-foreground-muted">{city.region}</span>}
                  </div>
                  <span className="text-[11px] font-data tabular-nums text-foreground-muted flex-shrink-0">{formatCurrency(city.totalSpent)}</span>
                </div>
              ))}
              {group.cities.length > 5 && (
                <div className="px-3 py-1 text-[9px] text-foreground-muted/50 text-center">+ {group.cities.length - 5} more</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
