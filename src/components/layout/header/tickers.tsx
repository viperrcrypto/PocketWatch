"use client"

import { useState, useEffect } from "react"

// ─── Types ───

interface TickerCoin {
  id: string
  symbol: string
  price: number
  change24h: number | null
}

interface StockQuote {
  symbol: string
  price: number
  changePercent: number
}

// ─── Constants ───

const TICKER_STOCKS: { symbol: string; name: string }[] = [
  { symbol: "AAPL", name: "Apple" },
  { symbol: "MSFT", name: "Microsoft" },
  { symbol: "GOOGL", name: "Google" },
  { symbol: "AMZN", name: "Amazon" },
  { symbol: "NVDA", name: "NVIDIA" },
  { symbol: "TSLA", name: "Tesla" },
  { symbol: "META", name: "Meta" },
  { symbol: "SPY", name: "S&P 500" },
  { symbol: "QQQ", name: "Nasdaq" },
  { symbol: "DIA", name: "Dow Jones" },
]

const TICKER_COINS: { id: string; symbol: string; key: string }[] = [
  { id: "bitcoin", symbol: "BTC", key: "coingecko:bitcoin" },
  { id: "ethereum", symbol: "ETH", key: "coingecko:ethereum" },
  { id: "solana", symbol: "SOL", key: "coingecko:solana" },
  { id: "binancecoin", symbol: "BNB", key: "coingecko:binancecoin" },
  { id: "ripple", symbol: "XRP", key: "coingecko:ripple" },
  { id: "cardano", symbol: "ADA", key: "coingecko:cardano" },
  { id: "dogecoin", symbol: "DOGE", key: "coingecko:dogecoin" },
  { id: "tron", symbol: "TRX", key: "coingecko:tron" },
  { id: "chainlink", symbol: "LINK", key: "coingecko:chainlink" },
  { id: "avalanche", symbol: "AVAX", key: "coingecko:avalanche-2" },
  { id: "polkadot", symbol: "DOT", key: "coingecko:polkadot" },
  { id: "shiba-inu", symbol: "SHIB", key: "coingecko:shiba-inu" },
  { id: "polygon", symbol: "POL", key: "coingecko:matic-network" },
  { id: "litecoin", symbol: "LTC", key: "coingecko:litecoin" },
  { id: "uniswap", symbol: "UNI", key: "coingecko:uniswap" },
  { id: "icp", symbol: "ICP", key: "coingecko:internet-computer" },
  { id: "render", symbol: "RENDER", key: "coingecko:render-token" },
  { id: "aptos", symbol: "APT", key: "coingecko:aptos" },
  { id: "hedera", symbol: "HBAR", key: "coingecko:hedera-hashgraph" },
  { id: "pepe", symbol: "PEPE", key: "coingecko:pepe" },
  { id: "near", symbol: "NEAR", key: "coingecko:near" },
  { id: "aave", symbol: "AAVE", key: "coingecko:aave" },
  { id: "sui", symbol: "SUI", key: "coingecko:sui" },
  { id: "sei", symbol: "SEI", key: "coingecko:sei-network" },
  { id: "injective", symbol: "INJ", key: "coingecko:injective-protocol" },
]

// ─── Crypto Ticker ───

function CryptoTicker() {
  const [coins, setCoins] = useState<TickerCoin[]>([])

  useEffect(() => {
    async function fetchPrices() {
      try {
        const keys = TICKER_COINS.map((c) => c.key).join(",")
        const [priceRes, pctRes] = await Promise.all([
          fetch(`https://coins.llama.fi/prices/current/${keys}`),
          fetch(`https://coins.llama.fi/percentage/${keys}`).catch(() => null),
        ])
        if (!priceRes.ok) return
        const priceData = await priceRes.json()
        const pctData = pctRes?.ok ? await pctRes.json() : null

        const result: TickerCoin[] = []
        for (const coin of TICKER_COINS) {
          const entry = priceData.coins?.[coin.key]
          if (entry?.price && entry.price > 0) {
            const change = pctData?.coins?.[coin.key] ?? null
            result.push({
              id: coin.id,
              symbol: coin.symbol,
              price: entry.price,
              change24h: typeof change === "number" ? change : null,
            })
          }
        }
        if (result.length > 0) setCoins(result)
      } catch {
        // silently fail — ticker is non-critical
      }
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 120_000)
    return () => clearInterval(interval)
  }, [])

  if (coins.length === 0) return (
    <div className="hidden md:flex items-center flex-1 mx-2 overflow-hidden border border-card-border bg-background-secondary rounded-lg" style={{ height: 32 }} />
  )

  const tickerContent = coins.map((coin) => {
    const priceDisplay = coin.price < 0.01
      ? coin.price.toFixed(8)
      : coin.price < 1
        ? coin.price.toFixed(4)
        : coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const isUp = coin.change24h !== null && coin.change24h >= 0

    return (
      <span key={coin.id} className="inline-flex items-center gap-1 mx-4">
        <span className="text-foreground-muted">{coin.symbol}</span>
        <span className="text-foreground font-data">${priceDisplay}</span>
        {coin.change24h !== null && (
          <span className={`text-[10px] inline-flex items-center gap-0.5 ${isUp ? "text-success" : "text-error"}`}>
            <span className="text-[9px]">{isUp ? "\u25B2" : "\u25BC"}</span>
            {Math.abs(coin.change24h).toFixed(1)}%
          </span>
        )}
      </span>
    )
  })

  return (
    <div className="hidden md:flex items-center flex-1 mx-2 overflow-hidden border border-card-border bg-background-secondary rounded-lg" style={{ height: 32 }}>
      <div className="flex items-center whitespace-nowrap animate-crypto-scroll font-data text-[11px] font-medium tracking-tight">
        {tickerContent}
        {tickerContent}
        {tickerContent}
        {tickerContent}
      </div>
      <style jsx>{`
        @keyframes crypto-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25%); }
        }
        .animate-crypto-scroll {
          animation: crypto-scroll 120s linear infinite;
        }
      `}</style>
    </div>
  )
}

// ─── Stock Ticker ───

function StockTicker() {
  const [stocks, setStocks] = useState<StockQuote[]>([])

  useEffect(() => {
    async function fetchStockPrices() {
      try {
        const symbols = TICKER_STOCKS.map((s) => s.symbol).join(",")
        const res = await fetch(`/api/stock-ticker?symbols=${symbols}`)
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data?.stocks)) return

        const result: StockQuote[] = []
        for (const q of data.stocks) {
          if (q.price) {
            result.push({ symbol: q.symbol, price: q.price, changePercent: q.changePercent ?? 0 })
          }
        }
        if (result.length > 0) setStocks(result)
      } catch {
        // silently fail
      }
    }
    fetchStockPrices()
    const interval = setInterval(fetchStockPrices, 120_000)
    return () => clearInterval(interval)
  }, [])

  if (stocks.length === 0) return (
    <div className="hidden md:flex items-center flex-1 mx-2 overflow-hidden border border-card-border bg-background-secondary rounded-lg" style={{ height: 32 }} />
  )

  const tickerContent = stocks.map((stock) => {
    const isUp = stock.changePercent >= 0
    const hasChange = stock.changePercent !== 0

    return (
      <span key={stock.symbol} className="inline-flex items-center gap-1 mx-4">
        <span className="text-foreground-muted">{stock.symbol}</span>
        <span className="text-foreground font-data">${stock.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        {hasChange && (
          <span className={`text-[10px] inline-flex items-center gap-0.5 ${isUp ? "text-success" : "text-error"}`}>
            <span className="text-[9px]">{isUp ? "\u25B2" : "\u25BC"}</span>
            {Math.abs(stock.changePercent).toFixed(1)}%
          </span>
        )}
      </span>
    )
  })

  return (
    <div className="hidden md:flex items-center flex-1 mx-2 overflow-hidden border border-card-border bg-background-secondary rounded-lg" style={{ height: 32 }}>
      <div className="flex items-center whitespace-nowrap animate-stock-scroll font-data text-[11px] font-medium tracking-tight">
        {tickerContent}
        {tickerContent}
        {tickerContent}
        {tickerContent}
      </div>
      <style jsx>{`
        @keyframes stock-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25%); }
        }
        .animate-stock-scroll {
          animation: stock-scroll 100s linear infinite;
        }
      `}</style>
    </div>
  )
}

// ─── Tabbed Ticker ───

export function TabbedTicker() {
  const [mode, setMode] = useState<"crypto" | "stocks">("crypto")

  return (
    <div className="hidden md:flex items-center flex-1 mx-2 gap-2 relative min-w-0">
      <div className="flex items-center bg-background-secondary border border-card-border rounded-full p-0.5 flex-shrink-0">
        <button
          onClick={() => setMode("crypto")}
          className={`px-2.5 py-1 text-[9px] font-semibold tracking-wider rounded-full transition-all ${
            mode === "crypto" ? "bg-card text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          CRYPTO
        </button>
        <button
          onClick={() => setMode("stocks")}
          className={`px-2.5 py-1 text-[9px] font-semibold tracking-wider rounded-full transition-all ${
            mode === "stocks" ? "bg-card text-foreground shadow-sm" : "text-foreground-muted hover:text-foreground"
          }`}
        >
          STOCKS
        </button>
      </div>
      <div className="flex-1 min-w-0">
        {mode === "crypto" ? <CryptoTicker /> : <StockTicker />}
      </div>
    </div>
  )
}
