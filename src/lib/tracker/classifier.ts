// Transaction classifier utilities for the Wallet Tracker.
// Refines BUY/SELL classification using token transfer analysis.

import type { NewTransaction, TransactionType, TrackerTransaction } from "./types"

// Shared shape that both NewTransaction and TrackerTransaction satisfy
type TxLike = Pick<
  NewTransaction,
  "type" | "chain" | "tokenAddress" | "tokenSymbol" | "amountFormatted" |
  "tokenInAddress" | "tokenInSymbol" | "tokenInAmount" |
  "tokenOutAddress" | "tokenOutSymbol" | "tokenOutAmount" |
  "fromAddress" | "toAddress" | "valueUsd" | "marketCap" | "txHash" | "dexName" |
  "tokenName" | "priceUsd"
>

/**
 * Refine transaction classification based on token flows.
 * A BUY = wallet receives token, sends native (ETH/SOL).
 * A SELL = wallet sends token, receives native.
 */
export function refineTransactionType(tx: NewTransaction, walletAddress: string): TransactionType {
  const wallet = walletAddress.toLowerCase()

  // If it's a swap with token in/out info, classify based on what the wallet received
  if (tx.tokenOutAddress && tx.tokenInAddress) {
    // Wallet received tokenOut and sent tokenIn
    // If tokenIn is native-like (WETH, WSOL) and tokenOut is a token => BUY
    // If tokenIn is a token and tokenOut is native-like => SELL
    const nativeSymbols = ["ETH", "WETH", "SOL", "WSOL", "BNB", "WBNB", "MATIC", "WMATIC", "POL", "WPOL"]
    const tokenInIsNative = nativeSymbols.includes(tx.tokenInSymbol?.toUpperCase() || "")
    const tokenOutIsNative = nativeSymbols.includes(tx.tokenOutSymbol?.toUpperCase() || "")

    if (tokenInIsNative && !tokenOutIsNative) return "BUY"
    if (!tokenInIsNative && tokenOutIsNative) return "SELL"
    return "SWAP" // Token-to-token swap
  }

  // Check transfer direction
  if (tx.fromAddress?.toLowerCase() === wallet && tx.toAddress?.toLowerCase() !== wallet) {
    return tx.type === "UNKNOWN" ? "TRANSFER_OUT" : tx.type
  }
  if (tx.toAddress?.toLowerCase() === wallet && tx.fromAddress?.toLowerCase() !== wallet) {
    return tx.type === "UNKNOWN" ? "TRANSFER_IN" : tx.type
  }

  return tx.type
}

/**
 * Determine the primary display token for a transaction.
 * For BUYs, show the token bought. For SELLs, show the token sold.
 */
export function getPrimaryToken(tx: TxLike): {
  address?: string
  symbol?: string
  amount?: number
} {
  switch (tx.type) {
    case "BUY":
      // Token bought = token out (wallet received)
      return {
        address: tx.tokenOutAddress || tx.tokenAddress,
        symbol: tx.tokenOutSymbol || tx.tokenSymbol,
        amount: tx.tokenOutAmount || tx.amountFormatted,
      }
    case "SELL":
      // Token sold = token in (wallet sent)
      return {
        address: tx.tokenInAddress || tx.tokenAddress,
        symbol: tx.tokenInSymbol || tx.tokenSymbol,
        amount: tx.tokenInAmount || tx.amountFormatted,
      }
    default:
      return {
        address: tx.tokenAddress,
        symbol: tx.tokenSymbol,
        amount: tx.amountFormatted,
      }
  }
}

/**
 * Get the native token amount in a swap (SOL/ETH spent or received).
 */
export function getNativeAmount(tx: TxLike): {
  symbol: string
  amount?: number
  direction: "spent" | "received"
} {
  const nativeSymbols = ["ETH", "WETH", "SOL", "WSOL", "BNB", "WBNB", "MATIC", "WMATIC", "POL", "WPOL"]

  if (tx.type === "BUY") {
    // For BUY, native was spent (token in)
    if (nativeSymbols.includes(tx.tokenInSymbol?.toUpperCase() || "")) {
      return { symbol: tx.tokenInSymbol || "", amount: tx.tokenInAmount, direction: "spent" }
    }
  }

  if (tx.type === "SELL") {
    // For SELL, native was received (token out)
    if (nativeSymbols.includes(tx.tokenOutSymbol?.toUpperCase() || "")) {
      return { symbol: tx.tokenOutSymbol || "", amount: tx.tokenOutAmount, direction: "received" }
    }
  }

  return {
    symbol: tx.chain === "SOLANA" ? "SOL" : tx.chain === "BSC" ? "BNB" : "ETH",
    amount: tx.amountFormatted,
    direction: tx.type === "BUY" ? "spent" : "received",
  }
}

/**
 * Format a number for display (e.g., 1234567 -> "1.23M", 0.00001234 -> "0.00001234").
 */
export function formatAmount(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "—"
  if (amount === 0) return "0"

  const abs = Math.abs(amount)

  if (abs >= 1e9) return `${(amount / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(amount / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(amount / 1e3).toFixed(2)}K`
  if (abs >= 1) return amount.toFixed(2)
  if (abs >= 0.0001) return amount.toFixed(4)

  // Very small numbers - show significant digits
  return amount.toPrecision(4)
}

/**
 * Format USD value for display.
 */
export function formatUsd(value: number | undefined | null): string {
  if (value === undefined || value === null) return "—"
  if (value === 0) return "$0"

  const abs = Math.abs(value)
  const sign = value < 0 ? "-" : ""

  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(2)}K`
  if (abs >= 0.01) return `${sign}$${abs.toFixed(2)}`

  return `${sign}$${abs.toPrecision(4)}`
}

/**
 * Format a token price for display.
 */
export function formatPrice(price: number | undefined | null): string {
  if (price === undefined || price === null) return "—"
  if (price === 0) return "$0"

  if (price >= 1) return `$${price.toFixed(2)}`
  if (price >= 0.0001) return `$${price.toFixed(6)}`

  // Very small prices - count leading zeros
  const str = price.toFixed(20)
  const match = str.match(/^0\.(0+)/)
  if (match) {
    const zeros = match[1].length
    const significantDigits = price.toPrecision(4).replace(/^0\.0+/, "")
    return `$0.0{${zeros}}${significantDigits}`
  }

  return `$${price.toPrecision(4)}`
}

/**
 * Get relative time string (e.g., "2m ago", "1h ago").
 */
export function getRelativeTime(timestamp: string | Date): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = now - then

  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
