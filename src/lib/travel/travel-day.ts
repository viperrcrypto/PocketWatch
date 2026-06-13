/**
 * Travel-day briefing — destination weather (WeatherAPI) + next flight segment.
 *
 * Weather key is read ONLY from process.env.WEATHERAPI_KEY. It is never logged
 * and never returned to the client. If the key is unset OR any fetch fails, the
 * briefing degrades gracefully to weather:null and never throws.
 */

const WEATHER_ENDPOINT = "https://api.weatherapi.com/v1/forecast.json"
const FETCH_TIMEOUT_MS = 6_000
const HIGH_RAIN_THRESHOLD = 60
const COLD_THRESHOLD_F = 40
const HOT_THRESHOLD_F = 90

export interface BriefingSegment {
  type: string
  title: string
  startAt: string | null
  endAt: string | null
  location: string | null
}

export interface BriefingTrip {
  destination: string | null
  startDate: string
  segments: BriefingSegment[]
}

export interface BriefingWeather {
  tempF: number
  condition: string
  forecastHigh: number
  forecastLow: number
  chanceOfRain: number
}

export interface BriefingNextFlight {
  title: string
  startAt: string
  location: string | null
}

export interface TravelDayBriefing {
  weather: BriefingWeather | null
  nextFlight: BriefingNextFlight | null
  tips: string[]
}

/** Earliest future flight-type segment with a parseable startAt. */
function findNextFlight(segments: readonly BriefingSegment[]): BriefingNextFlight | null {
  const now = Date.now()
  const upcoming = segments
    .filter((s) => s.type === "flight" && s.startAt !== null)
    .map((s) => ({ seg: s, at: Date.parse(s.startAt as string) }))
    .filter(({ at }) => Number.isFinite(at) && at >= now)
    .sort((a, b) => a.at - b.at)

  const first = upcoming[0]
  if (!first) return null

  return {
    title: first.seg.title,
    startAt: first.seg.startAt as string,
    location: first.seg.location,
  }
}

/** Fetch + parse WeatherAPI forecast. Returns null on missing key or any failure. */
async function fetchWeather(destination: string): Promise<BriefingWeather | null> {
  const key = process.env.WEATHERAPI_KEY
  if (!key) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const url = new URL(WEATHER_ENDPOINT)
    url.searchParams.set("key", key)
    url.searchParams.set("q", destination)
    url.searchParams.set("days", "2")
    url.searchParams.set("aqi", "no")

    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null

    const data = (await res.json()) as WeatherApiResponse
    return parseWeather(data)
  } catch {
    // Network error, timeout, or bad JSON — degrade gracefully.
    return null
  } finally {
    clearTimeout(timeout)
  }
}

interface WeatherApiResponse {
  current?: { temp_f?: number; condition?: { text?: string } }
  forecast?: {
    forecastday?: Array<{
      day?: {
        maxtemp_f?: number
        mintemp_f?: number
        daily_chance_of_rain?: number
      }
    }>
  }
}

/** Parse current temp/condition + the next-day forecast high/low/rain chance. */
function parseWeather(data: WeatherApiResponse): BriefingWeather | null {
  const tempF = data.current?.temp_f
  const condition = data.current?.condition?.text
  // Next day = index 1 when present, else fall back to today (index 0).
  const days = data.forecast?.forecastday ?? []
  const day = (days[1] ?? days[0])?.day
  if (typeof tempF !== "number" || !condition || !day) return null

  return {
    tempF: Math.round(tempF),
    condition,
    forecastHigh: Math.round(day.maxtemp_f ?? tempF),
    forecastLow: Math.round(day.mintemp_f ?? tempF),
    chanceOfRain: Math.round(day.daily_chance_of_rain ?? 0),
  }
}

/** Human travel-day hints derived from weather + flight presence. */
function buildTips(weather: BriefingWeather | null, nextFlight: BriefingNextFlight | null): string[] {
  const tips: string[] = []

  if (weather) {
    if (weather.chanceOfRain >= HIGH_RAIN_THRESHOLD) {
      tips.push("Rain likely — allow extra airport time and pack a layer.")
    }
    if (weather.forecastLow <= COLD_THRESHOLD_F) {
      tips.push("Cold at your destination — bring a warm layer.")
    }
    if (weather.forecastHigh >= HOT_THRESHOLD_F) {
      tips.push("Hot at your destination — pack light and stay hydrated.")
    }
  }

  if (nextFlight) {
    tips.push("You have an upcoming flight — check in and confirm your gate before you leave.")
  }

  return tips
}

/**
 * Build the travel-day briefing for a trip. Never throws — returns nulls on any
 * failure so callers can render a partial card.
 */
export async function buildTravelDayBriefing(trip: BriefingTrip): Promise<TravelDayBriefing> {
  const nextFlight = findNextFlight(trip.segments)

  let weather: BriefingWeather | null = null
  if (trip.destination) {
    weather = await fetchWeather(trip.destination)
  }

  return { weather, nextFlight, tips: buildTips(weather, nextFlight) }
}
