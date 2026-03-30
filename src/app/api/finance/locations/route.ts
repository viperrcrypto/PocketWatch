import { getCurrentUser, withUserEncryption } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { lookupCityCoordinates } from "@/lib/finance/city-coordinates"
import { NextResponse } from "next/server"

interface PlaidLocation {
  address?: string | null
  city?: string | null
  region?: string | null
  postalCode?: string | null
  country?: string | null
  lat?: number | null
  lon?: number | null
  storeNumber?: string | null
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F9001", "Authentication required", 401)

  return withUserEncryption(async () => {
    try {
      const transactions = await db.financeTransaction.findMany({
        where: { userId: user.id, isDuplicate: false, isExcluded: false },
        select: { location: true, amount: true },
      })

      const cityMap = new Map<string, { city: string; region: string | null; country: string; lat: number; lon: number; count: number; spent: number }>()

      for (const tx of transactions) {
        const loc = tx.location as PlaidLocation | null
        if (!loc || !loc.city) continue

        const country = loc.country ?? "US"
        let lat = loc.lat
        let lon = loc.lon

        // Fallback: look up coordinates from city database if Plaid didn't provide them
        if (lat == null || lon == null) {
          const coords = lookupCityCoordinates(loc.city, country)
          if (coords) {
            lat = coords[0]
            lon = coords[1]
          } else {
            continue // Can't map without coordinates
          }
        }

        const key = `${loc.city}|${country}`
        const existing = cityMap.get(key)
        if (existing) {
          existing.count++
          existing.spent += Math.abs(tx.amount)
        } else {
          cityMap.set(key, {
            city: loc.city,
            region: loc.region ?? null,
            country,
            lat,
            lon,
            count: 1,
            spent: Math.abs(tx.amount),
          })
        }
      }

      const locations = Array.from(cityMap.values())
        .map((v) => ({
          city: v.city,
          region: v.region,
          country: v.country,
          lat: v.lat,
          lon: v.lon,
          transactionCount: v.count,
          totalSpent: Math.round(v.spent * 100) / 100,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)

      const countries = new Set(locations.map((l) => l.country))

      return NextResponse.json({
        locations,
        stats: {
          countryCount: countries.size,
          cityCount: locations.length,
          transactionCount: locations.reduce((s, l) => s + l.transactionCount, 0),
          totalSpent: Math.round(locations.reduce((s, l) => s + l.totalSpent, 0) * 100) / 100,
        },
      })
    } catch (err) {
      return apiError("F9002", "Failed to load location data", 500, err)
    }
  })
}
