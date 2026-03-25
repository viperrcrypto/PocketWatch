/**
 * Shared types for the Travel (flight search) module.
 */

// ─── Flight Search Types ─────────────────────────────────────────

export interface UnifiedFlightResult {
  id: string
  source: "roame" | "google" | "hidden-city" | "atf" | "pointme"
  type: "award" | "cash"
  tags?: string[]
  // Route
  origin: string
  destination: string
  airline: string
  operatingAirlines: string[]
  flightNumbers: string[]
  stops: number
  durationMinutes: number
  departureTime: string
  arrivalTime: string
  airports: string[]
  cabinClass: string
  equipment: string[]
  // Pricing
  points: number | null
  pointsProgram: string | null
  cashPrice: number | null
  taxes: number
  currency: string
  // Valuation
  cppValue: number | null
  roameScore: number | null
  availableSeats: number | null
  // Booking
  bookingUrl: string
  fareClass: string
  travelDate?: string
  leg?: "outbound" | "return"
  // Multi-airport search tagging
  searchOrigin?: string
  searchDestination?: string
  searchDate?: string
}

export interface ValueScoredFlight extends UnifiedFlightResult {
  realCpp: number | null
  cppRating: CppRating | null
  cashComparable: number | null
  cashSource: "exact-match" | "same-cabin" | "estimated" | null
  sweetSpotMatch: SweetSpotMatch | null
  fundingPath: FundingPath | null
  canAfford: boolean
  affordDetails: string
  valueScore: number
}

export type CppRating = "exceptional" | "great" | "good" | "fair" | "poor"

// ─── Sweet Spots ────────────────────────────────────────────────

export interface SweetSpot {
  id: string
  program: string
  programName: string
  routeType: string
  origins?: string[]
  destinations?: string[]
  originRegions?: string[]
  destRegions?: string[]
  cabin: "economy" | "premium_economy" | "business" | "first"
  maxPoints: number
  typicalCashPrice: number
  expectedCpp: number
  description: string
  bookingTip?: string
  airlines?: string[]
  oneWay: boolean
}

export interface SweetSpotMatch {
  spot: SweetSpot
  matchScore: number
  pointsSaved: number
  actualCpp: number
  label: string
}

// ─── Transfer Partners ──────────────────────────────────────────

export interface TransferPartner {
  from: string
  fromName: string
  to: string
  toName: string
  ratio: number
  transferTime: string
  notes?: string
}

export interface FundingPath {
  source: string
  sourceName: string
  sourceBalance: number
  pointsToTransfer: number
  milesReceived: number
  ratio: number
  transferTime: string
  covers: boolean
  notes?: string
}

// ─── Search Config & Results ────────────────────────────────────

export interface SearchConfig {
  origin: string
  destination: string
  departureDate: string
  searchClass: "ECON" | "PREM" | "both"
  tripType?: "one_way" | "round_trip"
  returnDate?: string
  flexDates?: boolean
  origins?: string[]
  destinations?: string[]
}

export interface PointsBalance {
  program: string
  programKey: string
  balance: number
  displayBalance: string
}

export interface Recommendation {
  rank: number
  title: string
  subtitle: string
  details: string[]
  totalCost: string
  cppValue: string | null
  bookingUrl: string
  badgeText: string
  badgeColor: "emerald" | "accent" | "gold"
}

export interface ValueInsight {
  type: "sweet-spot-available" | "transfer-bonus" | "cash-wins" | "book-now" | "route-tip"
  priority: "high" | "medium" | "low"
  title: string
  detail: string
  actionUrl?: string
}

export interface DashboardResults {
  meta: {
    origin: string
    destination: string
    departureDate: string
    searchedAt: string
    sources: string[]
    completionPct: Record<string, number>
    origins?: string[]
    destinations?: string[]
    flexDates?: boolean
  }
  balances: PointsBalance[]
  flights: ValueScoredFlight[]
  recommendations: Recommendation[]
  insights: ValueInsight[]
  routeSweetSpots: { program: string; cabin: string; maxPoints: number; description: string }[]
  warnings: string[]
}

// ─── Roame Types ────────────────────────────────────────────────

export interface RoameFare {
  arrivalDatetime: string
  availableSeats: number | null
  departureDate: string
  operatingAirlines: string[]
  flightsDepartureDatetimes: string[]
  flightsArrivalDatetimes: string[]
  fareClass: string
  flightNumberOrder: string[]
  durationMinutes: number
  equipmentTypes: string[]
  allAirports: string[]
  numStops: number
  mileageProgram: string
  percentPremiumInt: number
  cabinClasses: string[]
  originIata: string
  destinationIata: string
  departureDateStr: string
  awardPoints: number
  surcharge: number
  roameScore: number
}

export interface RoameCredentials {
  session: string
  csrfSecret?: string
  sessionExpiresAt?: number
}

// ─── Credential Types ───────────────────────────────────────────

export interface TravelCredentialInfo {
  service: string
  maskedKey: string
  updatedAt: string
}

// ─── Hotel Search Types ────────────────────────────────────────

export interface UnifiedHotelResult {
  id: string
  name: string
  description: string
  location: string
  hotelClass: number
  overallRating: number
  reviews: number
  amenities: string[]
  images: string[]
  // Cash pricing (from SerpAPI)
  cashPerNight: number | null
  cashTotal: number | null
  currency: string
  bookingLinks: { source: string; link: string; rate: number }[]
  // Points pricing (from Roame/ATF)
  pointsPerNight: number | null
  pointsProgram: string | null
  brand: string | null
  subBrand: string | null
  hotelCode: string | null
  // Geo coordinates (for map view)
  latitude: number | null
  longitude: number | null
  // Source tracking
  sources: ("serpapi" | "roame" | "atf")[]
}

export interface HotelSearchConfig {
  query: string
  checkInDate: string
  checkOutDate: string
  adults: number
  currency?: string
}

export interface HotelDashboardResults {
  meta: {
    query: string
    checkIn: string
    checkOut: string
    adults: number
    searchedAt: string
    sources: string[]
  }
  hotels: UnifiedHotelResult[]
}

// ─── PocketWatch Picks ─────────────────────────────────────────

export type PickCategory = "pocketwatch-pick" | "best-value" | "quickest" | "nonstop" | "sweet-spot"

export interface PickCandidate {
  category: PickCategory
  flight: ValueScoredFlight
}

// ─── Search Progress (SSE) ──────────────────────────────────────

export interface SearchProgressEvent {
  source: string
  status: "searching" | "complete" | "failed"
  flights?: number
  error?: string
}
