/**
 * Shared types and helpers for the CCXT exchange client.
 */

import ccxt, { type Exchange } from "ccxt"
import { getExchangeById } from "./exchanges"

export interface ExchangeCredentials {
  apiKey: string
  secret: string
  passphrase?: string
}

export interface ExchangeBalance {
  exchange: string
  exchangeLabel: string
  asset: string
  amount: number
  free: number
  used: number
  usd_value: number
}

export interface ExchangeSummary {
  id: string
  label: string
  totalValue: number
  assetCount: number
  error?: string
  fetchedAt: string
}

export interface AllExchangeBalancesResult {
  balances: ExchangeBalance[]
  exchanges: ExchangeSummary[]
  totalValue: number
}

export type ExchangeTransactionType = "deposit" | "withdrawal" | "trade"
export type ExchangeTradeSide = "buy" | "sell" | null

export interface ExchangeTransaction {
  id: string
  txid: string | null
  timestamp: number // milliseconds
  type: ExchangeTransactionType
  side?: ExchangeTradeSide
  amount: number
  currency: string
  status: string
  address: string | null
  fee: number
  network: string | null
  exchange: string
  exchangeLabel: string
}

export interface ExchangeCapability {
  id: string
  label: string
  supportsDeposits: boolean
  supportsWithdrawals: boolean
  supportsTrades: boolean
  error?: string
}

export interface AllExchangeTransactionsResult {
  transactions: ExchangeTransaction[]
  capabilities: ExchangeCapability[]
}

/** Create a fresh ccxt exchange instance — never cache these */
export function createExchange(ccxtId: string, credentials: ExchangeCredentials): Exchange {
  const ExchangeClass = (ccxt as Record<string, any>)[ccxtId]
  if (!ExchangeClass) {
    throw new Error(`Unsupported exchange: ${ccxtId}`)
  }

  const config: Record<string, unknown> = {
    apiKey: credentials.apiKey,
    secret: credentials.secret,
    timeout: 30_000,
    enableRateLimit: true,
  }
  if (credentials.passphrase) {
    config.password = credentials.passphrase
  }

  return new ExchangeClass(config) as Exchange
}

export const EXCHANGE_PRICE_CACHE_TTL_MS = 5 * 60_000
export const exchangePriceCache = new Map<string, { prices: Record<string, number>; expiresAt: number }>()

export const FETCH_LIMIT = 200
export const COINBASE_ACCOUNT_FETCH_LIMIT = 25

// ─── Transaction mapping helpers ───

/** Map a raw CCXT transaction to our normalized shape */
export function mapCcxtTransaction(
  raw: Record<string, unknown>,
  type: "deposit" | "withdrawal",
  exchangeId: string,
  exchangeLabel: string,
): ExchangeTransaction {
  const fee = raw.fee as Record<string, unknown> | null
  return {
    id: String(raw.id ?? `${exchangeId}-${type}-${raw.timestamp}`),
    txid: raw.txid != null ? String(raw.txid) : null,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : Date.now(),
    type,
    amount: typeof raw.amount === "number" ? raw.amount : parseFloat(String(raw.amount)) || 0,
    currency: String(raw.currency ?? ""),
    status: String(raw.status ?? "unknown"),
    address: raw.address != null ? String(raw.address) : null,
    fee: fee && typeof fee.cost === "number" ? fee.cost : 0,
    network: raw.network != null ? String(raw.network) : null,
    exchange: exchangeId,
    exchangeLabel,
  }
}

export function normalizeTimestampToMs(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return Date.now()
  return value < 1_000_000_000_000 ? Math.floor(value * 1000) : Math.floor(value)
}

function symbolBaseAsset(symbol: string | undefined): string {
  if (!symbol) return ""
  const [base] = symbol.split("/")
  return base ?? ""
}

export function mapCcxtTrade(
  raw: Record<string, unknown>,
  exchangeId: string,
  exchangeLabel: string,
): ExchangeTransaction {
  const fee = raw.fee as Record<string, unknown> | null
  const sideRaw = typeof raw.side === "string" ? raw.side.toLowerCase() : ""
  const side: ExchangeTradeSide = sideRaw === "buy" || sideRaw === "sell" ? sideRaw : null
  const symbol = typeof raw.symbol === "string" ? raw.symbol : undefined
  const amountValue = typeof raw.amount === "number"
    ? raw.amount
    : (typeof raw.filled === "number" ? raw.filled : parseFloat(String(raw.amount ?? raw.filled ?? 0)) || 0)

  return {
    id: String(raw.id ?? raw.order ?? `${exchangeId}-trade-${raw.timestamp ?? Date.now()}`),
    txid: raw.id != null ? String(raw.id) : (raw.order != null ? String(raw.order) : null),
    timestamp: normalizeTimestampToMs(raw.timestamp),
    type: "trade",
    side,
    amount: amountValue,
    currency: String(raw.base ?? symbolBaseAsset(symbol) ?? raw.currency ?? ""),
    status: String(raw.status ?? "ok"),
    address: null,
    fee: fee && typeof fee.cost === "number" ? fee.cost : 0,
    network: null,
    exchange: exchangeId,
    exchangeLabel,
  }
}

export function mapClosedOrderToTrade(
  raw: Record<string, unknown>,
  exchangeId: string,
  exchangeLabel: string,
): ExchangeTransaction | null {
  const filled = typeof raw.filled === "number"
    ? raw.filled
    : parseFloat(String(raw.filled ?? raw.amount ?? 0)) || 0
  if (!Number.isFinite(filled) || filled <= 0) return null

  const sideRaw = typeof raw.side === "string" ? raw.side.toLowerCase() : ""
  const side: ExchangeTradeSide = sideRaw === "buy" || sideRaw === "sell" ? sideRaw : null
  const symbol = typeof raw.symbol === "string" ? raw.symbol : undefined
  const fee = raw.fee as Record<string, unknown> | null

  return {
    id: String(raw.id ?? `${exchangeId}-order-trade-${raw.timestamp ?? Date.now()}`),
    txid: raw.id != null ? String(raw.id) : null,
    timestamp: normalizeTimestampToMs(raw.timestamp),
    type: "trade",
    side,
    amount: filled,
    currency: String(raw.base ?? symbolBaseAsset(symbol) ?? ""),
    status: String(raw.status ?? "closed"),
    address: null,
    fee: fee && typeof fee.cost === "number" ? fee.cost : 0,
    network: null,
    exchange: exchangeId,
    exchangeLabel,
  }
}

export function dedupeTransactions(transactions: ExchangeTransaction[]): ExchangeTransaction[] {
  const seen = new Set<string>()
  const deduped: ExchangeTransaction[] = []
  for (const tx of transactions) {
    const key = [
      tx.exchange,
      tx.type,
      tx.side ?? "",
      tx.txid ?? "",
      tx.timestamp,
      tx.currency,
      tx.amount,
    ].join("|")
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(tx)
  }
  return deduped
}
