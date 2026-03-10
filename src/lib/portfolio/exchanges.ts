/**
 * Exchange definitions and helpers for centralized exchange integrations.
 * Uses ccxt exchange IDs for the underlying client.
 */

export interface ExchangeDefinition {
  /** Internal ID used as DB key suffix: "exchange_binance" */
  id: string
  /** Human-readable label */
  label: string
  /** ccxt exchange class name */
  ccxtId: string
  /** Domain for favicon/logo */
  domain: string
  /** Whether this exchange requires a passphrase (e.g. KuCoin, Coinbase) */
  requiresPassphrase: boolean
  /** Short description */
  description: string
  /** URL to create API keys */
  keyUrl: string
  /** Whether the API secret is a multi-line PEM key (e.g. Coinbase CDP) */
  pemSecret?: boolean
}

export const SUPPORTED_EXCHANGES: ExchangeDefinition[] = [
  {
    id: "binance",
    label: "Binance",
    ccxtId: "binance",
    domain: "binance.com",
    requiresPassphrase: false,
    description: "Largest global crypto exchange by volume",
    keyUrl: "https://www.binance.com/en/my/settings/api-management",
  },
  {
    id: "coinbase",
    label: "Coinbase",
    ccxtId: "coinbase",
    domain: "coinbase.com",
    requiresPassphrase: false,
    description: "US-regulated exchange with broad asset support",
    keyUrl: "https://portal.cdp.coinbase.com/access/api",
    pemSecret: true,
  },
  {
    id: "kraken",
    label: "Kraken",
    ccxtId: "kraken",
    domain: "kraken.com",
    requiresPassphrase: false,
    description: "Established exchange with advanced trading features",
    keyUrl: "https://www.kraken.com/u/security/api",
  },
  {
    id: "kucoin",
    label: "KuCoin",
    ccxtId: "kucoin",
    domain: "kucoin.com",
    requiresPassphrase: true,
    description: "Popular altcoin exchange with many trading pairs",
    keyUrl: "https://www.kucoin.com/account/api",
  },
  {
    id: "okx",
    label: "OKX",
    ccxtId: "okx",
    domain: "okx.com",
    requiresPassphrase: true,
    description: "Global exchange with spot, futures, and DeFi",
    keyUrl: "https://www.okx.com/account/my-api",
  },
  {
    id: "bybit",
    label: "Bybit",
    ccxtId: "bybit",
    domain: "bybit.com",
    requiresPassphrase: false,
    description: "Derivatives and spot exchange with deep liquidity",
    keyUrl: "https://www.bybit.com/app/user/api-management",
  },
  {
    id: "bitget",
    label: "Bitget",
    ccxtId: "bitget",
    domain: "bitget.com",
    requiresPassphrase: true,
    description: "Copy-trading focused exchange with spot and futures",
    keyUrl: "https://www.bitget.com/account/newapi",
  },
  {
    id: "gateio",
    label: "Gate.io",
    ccxtId: "gate",
    domain: "gate.io",
    requiresPassphrase: false,
    description: "Exchange with 1400+ trading pairs",
    keyUrl: "https://www.gate.io/myaccount/apiv4keys",
  },
  {
    id: "mexc",
    label: "MEXC",
    ccxtId: "mexc",
    domain: "mexc.com",
    requiresPassphrase: false,
    description: "Exchange known for early altcoin listings",
    keyUrl: "https://www.mexc.com/user/openapi",
  },
  {
    id: "htx",
    label: "HTX",
    ccxtId: "htx",
    domain: "htx.com",
    requiresPassphrase: false,
    description: "Global exchange (formerly Huobi)",
    keyUrl: "https://www.htx.com/en-us/apikey/",
  },
]

const EXCHANGE_MAP = new Map(SUPPORTED_EXCHANGES.map((e) => [e.id, e]))
const EXCHANGE_IDS = new Set(SUPPORTED_EXCHANGES.map((e) => e.id))

/** Convert exchange ID to DB service name: "binance" → "exchange_binance" */
export function toExchangeServiceName(exchangeId: string): string {
  return `exchange_${exchangeId}`
}

/** Check if a service name is an exchange: "exchange_binance" → true */
export function isExchangeService(serviceName: string): boolean {
  if (!serviceName.startsWith("exchange_")) return false
  return EXCHANGE_IDS.has(serviceName.slice(9))
}

/** Extract exchange ID from service name: "exchange_binance" → "binance" */
export function fromExchangeServiceName(serviceName: string): string | null {
  if (!serviceName.startsWith("exchange_")) return null
  const id = serviceName.slice(9)
  return EXCHANGE_IDS.has(id) ? id : null
}

/** Get exchange definition by ID */
export function getExchangeById(id: string): ExchangeDefinition | undefined {
  return EXCHANGE_MAP.get(id)
}

/** Get exchange logo URL via Google Favicons */
export function getExchangeLogoUrl(domain: string, size = 64): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`
}
