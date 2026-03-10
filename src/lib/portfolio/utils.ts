/**
 * Parse a rotki string amount (e.g. "1234.567890123456789") into a number.
 * Returns 0 for unparseable values.
 */
export function parseRotkiAmount(amount: string): number {
  const parsed = Number(amount)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Smart-format a crypto amount with comma separators.
 * - Very small numbers (< 0.0001) use exponential notation.
 * - Default to 6 decimal places unless overridden.
 */
export function formatCryptoAmount(
  amount: number | string,
  decimals = 6
): string {
  const num = typeof amount === "string" ? parseRotkiAmount(amount) : amount

  if (num === 0) return "0"

  // Very small non-zero amounts: use exponential
  if (Math.abs(num) > 0 && Math.abs(num) < 0.0001) {
    return num.toExponential(2)
  }

  // Strip unnecessary trailing zeros after formatting
  const fixed = num.toFixed(decimals)
  const [intPart, decPart] = fixed.split(".")

  // Add commas to integer part
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

  if (!decPart) return withCommas

  // Trim trailing zeros but keep at least two decimals for readability
  const trimmed = decPart.replace(/0+$/, "")
  if (trimmed.length === 0) return withCommas

  return `${withCommas}.${trimmed}`
}

/**
 * Format a value as fiat currency (e.g. "$1,234.56").
 */
export function formatFiatValue(
  value: number | string,
  currency = "USD"
): string {
  const num = typeof value === "string" ? parseRotkiAmount(value) : value

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return formatter.format(num)
}

/**
 * Format a PnL value with +/- prefix and color class.
 * Returns an object with `text` and `colorClass` (Tailwind).
 */
export function formatPnL(value: number | string): {
  text: string
  colorClass: string
} {
  const num = typeof value === "string" ? parseRotkiAmount(value) : value

  const formatted = formatFiatValue(Math.abs(num))

  if (num > 0) {
    return { text: `+${formatted}`, colorClass: "text-success" }
  }

  if (num < 0) {
    return { text: `-${formatted}`, colorClass: "text-error" }
  }

  return { text: formatted, colorClass: "text-muted-foreground" }
}

/**
 * Format a percentage change with +/- prefix and color.
 */
export function formatPercentChange(value: number | string): {
  text: string
  colorClass: string
} {
  const num = typeof value === "string" ? parseRotkiAmount(value) : value
  const abs = Math.abs(num).toFixed(2)

  if (num > 0) {
    return { text: `+${abs}%`, colorClass: "text-success" }
  }

  if (num < 0) {
    return { text: `-${abs}%`, colorClass: "text-error" }
  }

  return { text: `${abs}%`, colorClass: "text-muted-foreground" }
}

/**
 * Normalize a wallet address for consistent DB queries and fingerprinting.
 * EVM addresses (0x prefix) are case-insensitive → lowercase.
 * Solana addresses (base58) are case-sensitive → preserve original case.
 */
export function normalizeWalletAddress(address: string): string {
  return address.startsWith("0x") ? address.toLowerCase() : address
}

/**
 * Shorten a blockchain address for display: 0x1234...abcd
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ""

  if (address.length <= chars * 2 + 2) return address

  const start = address.startsWith("0x") ? chars + 2 : chars
  return `${address.slice(0, start)}...${address.slice(-chars)}`
}
