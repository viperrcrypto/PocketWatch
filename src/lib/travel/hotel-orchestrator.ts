/**
 * Hotel search orchestrator.
 * Runs parallel searches across SerpAPI + Roame + ATF and merges results
 * into unified hotel results with both cash and points pricing.
 */

import type { UnifiedHotelResult, HotelSearchConfig, HotelDashboardResults } from "@/types/travel"
import { searchSerpApiHotels } from "./hotel-search-client"
import { searchRoameHotels, matchRoameHotel, type RoameHotelMatch } from "./roame-hotel-client"
import { searchATFHotels, atfBrandToProgram, type ATFHotelMatch } from "./atf-hotel-client"
import { searchRoameLocation, searchRoameHotelsLive, roameProgramLabel, type RoameLiveHotel } from "./roame-hotel-graphql"
import { searchTrivagoHotels } from "./trivago-client"

// ─── Credentials ────────────────────────────────────────────────

export interface HotelSearchCredentials {
  serpApiKey: string | null
  atfApiKey: string | null
  /** Keyless Trivago MCP (OTA cash prices). Free, so always enabled. */
  trivago?: boolean
}

// ─── Response Cache ─────────────────────────────────────────────

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const responseCache = new Map<string, { data: HotelDashboardResults; expiry: number }>()

function getCacheKey(config: HotelSearchConfig): string {
  return `hotel:${config.query}:${config.checkInDate}:${config.checkOutDate}:${config.adults}`
}

// ─── Roame Live → Unified ───────────────────────────────────────

function roameLiveToUnified(hotel: RoameLiveHotel): UnifiedHotelResult {
  const d = hotel.hotelDetail
  const summary = hotel.offerSummary
  const bestRoom = hotel.availableRooms[0]
  const bestOffer = bestRoom?.offerPeriods[0]

  return {
    id: `hotel-roame-${d.id}`,
    name: d.name,
    description: d.description || "",
    location: [d.city, d.stateProvince, d.country].filter(Boolean).join(", "),
    hotelClass: parseInt(d.category) || 0,
    overallRating: 0,
    reviews: 0,
    amenities: [],
    images: d.previewImg ? [d.previewImg] : [],
    cashPerNight: summary.cashPriceUsd > 0 ? summary.cashPriceUsd : null,
    cashTotal: null,
    currency: "USD",
    bookingLinks: d.url ? [{ source: roameProgramLabel(d.mileageProgram), link: d.url, rate: summary.cashPriceUsd }] : [],
    pointsPerNight: summary.awardPoints > 0 ? summary.awardPoints : null,
    pointsProgram: roameProgramLabel(d.mileageProgram),
    brand: d.brand,
    subBrand: null,
    hotelCode: d.id,
    latitude: d.location?.coordinates?.[1] ?? null,
    longitude: d.location?.coordinates?.[0] ?? null,
    sources: ["roame"],
    // Extra data from live search
    ...(summary.cpp > 0 ? {} : {}), // cpp available as summary.cpp if needed later
  }
}

// ─── Matching ───────────────────────────────────────────────────

function normalizeForMatch(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function matchATFHotel(serpApiName: string, atfHotels: ATFHotelMatch[]): ATFHotelMatch | null {
  const target = normalizeForMatch(serpApiName)

  for (const hotel of atfHotels) {
    const candidate = normalizeForMatch(hotel.name)
    if (candidate.includes(target) || target.includes(candidate)) {
      return hotel
    }
  }

  // Word overlap scoring
  const targetWords = serpApiName.toLowerCase().split(/\s+/)
  let bestMatch: ATFHotelMatch | null = null
  let bestScore = 0

  for (const hotel of atfHotels) {
    const candidateWords = hotel.name.toLowerCase().split(/\s+/)
    const overlap = targetWords.filter(
      (w) => w.length > 2 && candidateWords.some((cw) => cw.includes(w) || w.includes(cw)),
    ).length
    const score = overlap / Math.max(targetWords.length, candidateWords.length)

    if (score > bestScore && score > 0.4) {
      bestScore = score
      bestMatch = hotel
    }
  }

  return bestMatch
}

// ─── Merge Logic ────────────────────────────────────────────────

function mergePointsData(
  hotels: UnifiedHotelResult[],
  roameHotels: RoameHotelMatch[],
  atfHotels: ATFHotelMatch[],
): UnifiedHotelResult[] {
  return hotels.map((hotel) => {
    const merged = { ...hotel }

    // Try Roame match first (has actual points pricing)
    const roameMatch = matchRoameHotel(hotel.name, roameHotels)
    if (roameMatch && roameMatch.lowestAwardPoints > 0) {
      merged.pointsPerNight = roameMatch.lowestAwardPoints
      merged.pointsProgram = roameMatch.brand === "Hilton" ? "Hilton Honors"
        : roameMatch.brand === "Marriott" ? "Marriott Bonvoy"
        : roameMatch.brand === "Hyatt" ? "World of Hyatt"
        : null
      merged.brand = roameMatch.brand
      merged.subBrand = roameMatch.subBrand
      merged.hotelCode = roameMatch.hotelId
      merged.sources = [...merged.sources, "roame"]
    }

    // Try ATF match (has brand/availability info, may confirm or supplement Roame)
    const atfMatch = matchATFHotel(hotel.name, atfHotels)
    if (atfMatch) {
      if (!merged.brand) merged.brand = atfMatch.brand
      if (!merged.subBrand) merged.subBrand = atfMatch.subBrand
      if (!merged.pointsProgram) merged.pointsProgram = atfBrandToProgram(atfMatch.brand)
      if (!merged.hotelCode) merged.hotelCode = atfMatch.hotelCode
      if (!merged.location) merged.location = atfMatch.location
      if (!merged.sources.includes("atf")) merged.sources = [...merged.sources, "atf"]
    }

    return merged
  })
}

// ─── Merge Live Roame with SerpAPI ──────────────────────────────

function mergeLiveWithSerpApi(
  liveHotels: UnifiedHotelResult[],
  serpApiHotels: UnifiedHotelResult[],
  atfHotels: ATFHotelMatch[],
): UnifiedHotelResult[] {
  const merged = liveHotels.map((hotel) => {
    const result = { ...hotel }

    // Try to find SerpAPI match for reviews, ratings, amenities, extra images
    const serpMatch = serpApiHotels.find((s) => {
      const a = normalizeForMatch(hotel.name)
      const b = normalizeForMatch(s.name)
      return a.includes(b) || b.includes(a)
    })

    if (serpMatch) {
      if (serpMatch.overallRating > 0) result.overallRating = serpMatch.overallRating
      if (serpMatch.reviews > 0) result.reviews = serpMatch.reviews
      if (serpMatch.amenities.length > 0) result.amenities = serpMatch.amenities
      if (serpMatch.images.length > result.images.length) result.images = serpMatch.images
      if (!result.cashPerNight && serpMatch.cashPerNight) result.cashPerNight = serpMatch.cashPerNight
      if (!result.cashTotal && serpMatch.cashTotal) result.cashTotal = serpMatch.cashTotal
      if (result.latitude == null && serpMatch.latitude != null) result.latitude = serpMatch.latitude
      if (result.longitude == null && serpMatch.longitude != null) result.longitude = serpMatch.longitude
      if (serpMatch.bookingLinks.length > 0) {
        result.bookingLinks = [...result.bookingLinks, ...serpMatch.bookingLinks]
      }
      if (!result.sources.includes("serpapi")) result.sources = [...result.sources, "serpapi"]
    }

    // ATF enrichment
    const atfMatch = matchATFHotel(hotel.name, atfHotels)
    if (atfMatch) {
      if (!result.sources.includes("atf")) result.sources = [...result.sources, "atf"]
    }

    return result
  })

  // Add SerpAPI-only hotels that Roame didn't have (cash-only hotels)
  const liveNames = new Set(merged.map((h) => normalizeForMatch(h.name)))
  for (const serpHotel of serpApiHotels) {
    const normalized = normalizeForMatch(serpHotel.name)
    const alreadyExists = [...liveNames].some((n) => n.includes(normalized) || normalized.includes(n))
    if (!alreadyExists) {
      merged.push(serpHotel)
      liveNames.add(normalized)
    }
  }

  return merged
}

// ─── Add Points-Only Hotels ─────────────────────────────────────

function addPointsOnlyHotels(
  hotels: UnifiedHotelResult[],
  roameHotels: RoameHotelMatch[],
  existingNames: Set<string>,
  limit: number,
): UnifiedHotelResult[] {
  const pointsOnly: UnifiedHotelResult[] = []
  const normalizedExisting = new Set([...existingNames].map(normalizeForMatch))

  for (const roame of roameHotels) {
    if (pointsOnly.length >= limit) break
    if (roame.lowestAwardPoints <= 0) continue

    const normalized = normalizeForMatch(roame.name)
    if (normalizedExisting.has(normalized)) continue

    // Check word overlap to avoid adding duplicates with slightly different names
    const alreadyMatched = [...normalizedExisting].some((existing) =>
      existing.includes(normalized) || normalized.includes(existing),
    )
    if (alreadyMatched) continue

    pointsOnly.push({
      id: `hotel-roame-${roame.hotelId}`,
      name: roame.name,
      description: "",
      location: "",
      hotelClass: 0,
      overallRating: 0,
      reviews: 0,
      amenities: [],
      images: [],
      cashPerNight: null,
      cashTotal: null,
      currency: "USD",
      bookingLinks: [],
      pointsPerNight: roame.lowestAwardPoints,
      pointsProgram: roame.brand === "Hilton" ? "Hilton Honors"
        : roame.brand === "Marriott" ? "Marriott Bonvoy"
        : roame.brand === "Hyatt" ? "World of Hyatt"
        : null,
      brand: roame.brand,
      subBrand: roame.subBrand,
      hotelCode: roame.hotelId,
      latitude: null,
      longitude: null,
      sources: ["roame"],
    })
    normalizedExisting.add(normalized)
  }

  return [...hotels, ...pointsOnly]
}

// ─── Main Orchestrator ──────────────────────────────────────────

export async function searchHotels(
  config: HotelSearchConfig,
  credentials: HotelSearchCredentials,
): Promise<HotelDashboardResults> {
  // Check cache
  const cacheKey = getCacheKey(config)
  const cached = responseCache.get(cacheKey)
  if (cached && Date.now() < cached.expiry) {
    return cached.data
  }

  const sources: string[] = []
  const promises: Promise<void>[] = []

  let serpApiResults: UnifiedHotelResult[] = []
  let roameLiveResults: UnifiedHotelResult[] = []
  let roameStaticResults: RoameHotelMatch[] = []
  let atfResults: ATFHotelMatch[] = []
  let trivagoResults: UnifiedHotelResult[] = []

  // SerpAPI (cash prices, images, reviews)
  if (credentials.serpApiKey) {
    promises.push(
      searchSerpApiHotels(credentials.serpApiKey, config)
        .then((hotels) => {
          serpApiResults = hotels
          sources.push("serpapi")
        })
        .catch((err) => { console.warn(`[hotels] SerpAPI failed: ${(err as Error).message}`) }),
    )
  }

  // Roame Live GraphQL (real-time points + cash + CPP + room types)
  promises.push(
    (async () => {
      const bounding = await searchRoameLocation(config.query)
      if (!bounding) return
      const { hotels } = await searchRoameHotelsLive(
        bounding, config.checkInDate, config.checkOutDate,
      )
      roameLiveResults = hotels.map(roameLiveToUnified)
      sources.push("roame")
    })().catch((err) => {
      console.warn(`[hotels] Roame Live failed: ${(err as Error).message} — falling back to static`)
      return searchRoameHotels(config.query)
        .then((hotels) => {
          roameStaticResults = hotels
          console.log(`[hotels] Roame static fallback: ${hotels.length} matches for "${config.query}"`)
          if (!sources.includes("roame")) sources.push("roame")
        })
        .catch((err2) => {
          console.warn(`[hotels] Roame static also failed: ${(err2 as Error).message}`)
        })
    }),
  )

  // ATF (brand info + availability)
  if (credentials.atfApiKey) {
    promises.push(
      searchATFHotels(credentials.atfApiKey, config.query)
        .then((hotels) => {
          atfResults = hotels
          sources.push("atf")
        })
        .catch(() => { /* ATF failed — continue */ }),
    )
  }

  // Trivago (keyless MCP) — OTA-aggregated cash prices. Free, returns [] on failure.
  if (credentials.trivago) {
    promises.push(
      searchTrivagoHotels({
        query: config.query,
        checkInDate: config.checkInDate,
        checkOutDate: config.checkOutDate,
        adults: config.adults,
      })
        .then((hotels) => {
          trivagoResults = hotels
          if (hotels.length > 0) sources.push("trivago")
        })
        .catch((err) => { console.warn(`[hotels] Trivago failed: ${(err as Error).message}`) }),
    )
  }

  await Promise.all(promises)

  let merged: UnifiedHotelResult[]

  console.log(`[hotels] Results: serpapi=${serpApiResults.length}, roameLive=${roameLiveResults.length}, roameStatic=${roameStaticResults.length}, atf=${atfResults.length}`)

  if (roameLiveResults.length > 0) {
    // Live Roame results are already complete — merge with SerpAPI for reviews/ratings
    merged = mergeLiveWithSerpApi(roameLiveResults, serpApiResults, atfResults)
    console.log(`[hotels] Used Roame Live path: ${merged.length} hotels, ${merged.filter(h => h.pointsPerNight).length} with points`)
  } else {
    // Fallback: SerpAPI base + static Roame enrichment
    merged = mergePointsData(serpApiResults, roameStaticResults, atfResults)
    const withPoints = merged.filter(h => h.pointsPerNight).length
    const existingNames = new Set(merged.map((h) => h.name))
    merged = addPointsOnlyHotels(merged, roameStaticResults, existingNames, 10)
    console.log(`[hotels] Used fallback path: ${merged.length} hotels, ${withPoints} matched points from static, ${merged.length - serpApiResults.length} points-only added`)
  }

  // Append Trivago cash hotels not already covered (dedup by name).
  if (trivagoResults.length > 0) {
    const existing = new Set(merged.map((h) => h.name.toLowerCase().trim()))
    const fresh = trivagoResults.filter((h) => !existing.has(h.name.toLowerCase().trim()))
    if (fresh.length > 0) merged = [...merged, ...fresh]
    console.log(`[hotels] Trivago: ${trivagoResults.length} results, ${fresh.length} new appended`)
  }

  const result: HotelDashboardResults = {
    meta: {
      query: config.query,
      checkIn: config.checkInDate,
      checkOut: config.checkOutDate,
      adults: config.adults,
      searchedAt: new Date().toISOString(),
      sources,
    },
    hotels: merged,
  }

  // Cache the result
  responseCache.set(cacheKey, { data: result, expiry: Date.now() + CACHE_TTL_MS })

  return result
}
