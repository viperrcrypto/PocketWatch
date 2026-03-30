"use client"

import { useMemo } from "react"
import { formatCurrency } from "@/lib/utils"
import type { LocationPin } from "./where-ive-been-types"

// Country code → flag emoji
function countryFlag(code: string): string {
  if (!code || code.length !== 2) return ""
  const upper = code.toUpperCase()
  return String.fromCodePoint(
    ...Array.from(upper).map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

interface Props {
  locations: LocationPin[]
}

export function WhereIveBeenStats({ locations }: Props) {
  const byCountry = useMemo(() => {
    const map = new Map<string, { country: string; cities: LocationPin[]; totalSpent: number; totalTxns: number }>()
    for (const loc of locations) {
      const key = loc.country
      const existing = map.get(key)
      if (existing) {
        existing.cities.push(loc)
        existing.totalSpent += loc.totalSpent
        existing.totalTxns += loc.transactionCount
      } else {
        map.set(key, { country: key, cities: [loc], totalSpent: loc.totalSpent, totalTxns: loc.transactionCount })
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .map((c) => ({ ...c, cities: c.cities.sort((a, b) => b.totalSpent - a.totalSpent) }))
  }, [locations])

  if (byCountry.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-foreground-muted">No location data</p>
      </div>
    )
  }

  return (
    <div className="overflow-y-auto flex-1">
      <div className="space-y-4 p-4">
        {byCountry.map((group) => (
          <div key={group.country}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{countryFlag(group.country)}</span>
                <span className="text-sm font-semibold text-foreground">{group.country}</span>
              </div>
              <span className="text-xs font-data font-semibold tabular-nums text-foreground">{formatCurrency(group.totalSpent)}</span>
            </div>
            <div className="space-y-1 ml-8">
              {group.cities.map((city) => (
                <div key={`${city.city}-${city.country}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-foreground truncate">{city.city}</span>
                    {city.region && <span className="text-[10px] text-foreground-muted">{city.region}</span>}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-[10px] text-foreground-muted tabular-nums">{city.transactionCount} txns</span>
                    <span className="text-xs font-data tabular-nums text-foreground">{formatCurrency(city.totalSpent)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
