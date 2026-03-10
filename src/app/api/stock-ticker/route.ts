import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

interface CachedData {
  stocks: StockQuote[]
  timestamp: number
}

interface StockQuote {
  symbol: string
  price: number
  changePercent: number
}

const CACHE_TTL_MS = 2 * 60 * 1000 // 2 minutes
const FETCH_TIMEOUT_MS = 10_000
const MAX_SYMBOLS = 20

const cache = new Map<string, CachedData>()

// Yahoo Finance crumb auth — needed for v7 quote API
let crumbCache: { crumb: string; cookie: string; ts: number } | null = null
const CRUMB_TTL_MS = 25 * 60 * 1000

async function acquireCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache && Date.now() - crumbCache.ts < CRUMB_TTL_MS) {
    return { crumb: crumbCache.crumb, cookie: crumbCache.cookie }
  }

  try {
    // Fetch a Yahoo Finance page to get session cookies
    const pageRes = await fetch("https://finance.yahoo.com/quote/AAPL/", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    })

    const setCookies = pageRes.headers.getSetCookie?.() ?? []
    const cookie = setCookies.map((c) => c.split(";")[0]).join("; ")
    if (!cookie) return null

    // Now get crumb with those cookies
    const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Cookie: cookie,
      },
    })
    if (!crumbRes.ok) return null
    const crumb = await crumbRes.text()
    if (!crumb || crumb.startsWith("{")) return null

    crumbCache = { crumb, cookie, ts: Date.now() }
    return { crumb, cookie }
  } catch {
    return null
  }
}

// Fallback: scrape prices from Google Finance (no auth needed)
async function fetchFromGoogle(symbols: string[]): Promise<StockQuote[]> {
  const EXCHANGE_MAP: Record<string, string> = {
    AAPL: "NASDAQ", MSFT: "NASDAQ", GOOGL: "NASDAQ", AMZN: "NASDAQ",
    NVDA: "NASDAQ", TSLA: "NASDAQ", META: "NASDAQ", QQQ: "NASDAQ",
    SPY: "NYSEARCA", DIA: "NYSEARCA",
  }

  const results = await Promise.allSettled(
    symbols.map(async (symbol): Promise<StockQuote | null> => {
      try {
        const exchange = EXCHANGE_MAP[symbol] ?? "NASDAQ"
        const res = await fetch(`https://www.google.com/finance/quote/${symbol}:${exchange}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
            "Accept-Language": "en-US",
          },
        })
        if (!res.ok) return null
        const html = await res.text()

        const priceMatch = html.match(/data-last-price="([^"]+)"/)
        if (!priceMatch) return null

        // Try to extract previous close to calculate change
        const prevMatch = html.match(/Previous close[^>]*>[\s\S]*?<[^>]*>([\d,.]+)</)
        const price = parseFloat(priceMatch[1])
        let changePercent = 0
        if (prevMatch) {
          const prev = parseFloat(prevMatch[1].replace(/,/g, ""))
          if (prev > 0) changePercent = ((price - prev) / prev) * 100
        }

        return { symbol, price, changePercent }
      } catch {
        return null
      }
    })
  )

  const stocks: StockQuote[] = []
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) stocks.push(r.value)
  }
  return stocks
}

async function fetchAllSymbols(symbols: string[]): Promise<StockQuote[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    // Try Yahoo Finance v7 with crumb auth first
    const auth = await acquireCrumb()
    if (auth) {
      const joined = symbols.map((s) => encodeURIComponent(s)).join(",")
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${joined}&crumb=${encodeURIComponent(auth.crumb)}`
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Cookie: auth.cookie,
        },
        signal: controller.signal,
      })

      if (res.ok) {
        const data = await res.json()
        const quotes = data?.quoteResponse?.result
        if (Array.isArray(quotes) && quotes.length > 0) {
          const results: StockQuote[] = []
          for (const q of quotes) {
            if (q.regularMarketPrice) {
              results.push({
                symbol: q.symbol,
                price: q.regularMarketPrice,
                changePercent: q.regularMarketChangePercent ?? 0,
              })
            }
          }
          if (results.length > 0) return results
        }
      } else {
        // Clear crumb cache on auth failure
        crumbCache = null
      }
    }
  } catch {
    // Fall through to Google fallback
  } finally {
    clearTimeout(timeout)
  }

  // Fallback: Google Finance
  return fetchFromGoogle(symbols)
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const symbolsParam = request.nextUrl.searchParams.get("symbols")
  if (!symbolsParam) {
    return NextResponse.json({ error: "Missing symbols parameter" }, { status: 400 })
  }

  const symbols = symbolsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_SYMBOLS)

  if (symbols.length === 0) {
    return NextResponse.json({ error: "No valid symbols" }, { status: 400 })
  }

  // Return cached data if fresh (keyed by sorted symbol list)
  const cacheKey = symbols.sort().join(",")
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ stocks: cached.stocks })
  }

  const stocks = await fetchAllSymbols(symbols)

  if (stocks.length > 0) {
    cache.set(cacheKey, { stocks, timestamp: Date.now() })
  }

  return NextResponse.json({ stocks })
}
