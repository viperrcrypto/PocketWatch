/**
 * Exchange transaction history fetching (deposits, withdrawals, trades).
 */

import type { Exchange } from "ccxt"
import { getExchangeById } from "./exchanges"
import {
  createExchange,
  FETCH_LIMIT,
  COINBASE_ACCOUNT_FETCH_LIMIT,
  mapCcxtTransaction,
  mapCcxtTrade,
  mapClosedOrderToTrade,
  dedupeTransactions,
} from "./exchange-types"
import type {
  ExchangeCredentials,
  ExchangeTransaction,
  ExchangeCapability,
  AllExchangeTransactionsResult,
} from "./exchange-types"

/** Paginate through fetchDeposits or fetchWithdrawals using timestamp cursors */
async function fetchAllPaginated(
  exchange: Exchange,
  method: "fetchDeposits" | "fetchWithdrawals",
  params?: Record<string, unknown>,
): Promise<unknown[]> {
  const all: unknown[] = []
  let since: number | undefined = undefined
  const MAX_PAGES = 10 // safety cap

  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await (exchange[method] as Function)(undefined, since, FETCH_LIMIT, params)
    const items = batch as unknown[]
    if (!items || items.length === 0) break
    all.push(...items)
    if (items.length < FETCH_LIMIT) break
    // Use last item's timestamp as cursor for next page
    const lastTs = (items[items.length - 1] as Record<string, unknown>)?.timestamp
    if (typeof lastTs === "number") {
      since = lastTs + 1
    } else {
      break
    }
  }

  return all
}

async function fetchCoinbaseTransfers(
  exchange: Exchange,
  exchangeId: string,
  label: string,
): Promise<{
  transactions: ExchangeTransaction[]
  depositOk: boolean
  withdrawalOk: boolean
  warning?: string
}> {
  const accounts = await exchange.fetchAccounts()
  const accountIds = (accounts || [])
    .map((account) => {
      const id = (account as { id?: unknown }).id
      return typeof id === "string" ? id : null
    })
    .filter((id): id is string => Boolean(id))
  const limitedAccountIds = accountIds.slice(0, COINBASE_ACCOUNT_FETCH_LIMIT)

  if (limitedAccountIds.length === 0) {
    return {
      transactions: [],
      depositOk: false,
      withdrawalOk: false,
      warning: "No Coinbase accounts available for transfer history",
    }
  }

  const transactions: ExchangeTransaction[] = []
  let depositSuccess = false
  let withdrawalSuccess = false
  let failedAccountCalls = 0
  let totalAccountCalls = 0

  for (const accountId of limitedAccountIds) {
    const [depositsRes, withdrawalsRes] = await Promise.allSettled([
      fetchAllPaginated(exchange, "fetchDeposits", { account_id: accountId, currencyType: "crypto" }),
      fetchAllPaginated(exchange, "fetchWithdrawals", { account_id: accountId, currencyType: "crypto" }),
    ])
    totalAccountCalls += 2

    if (depositsRes.status === "fulfilled") {
      depositSuccess = true
      const deposits = depositsRes.value as unknown as Record<string, unknown>[]
      transactions.push(...deposits.map((d) => mapCcxtTransaction(d, "deposit", exchangeId, label)))
    } else {
      failedAccountCalls += 1
      console.warn("[exchange-client][E9101_COINBASE_DEPOSITS_ACCOUNT_FAILED]", {
        exchangeId,
        accountId,
        error: depositsRes.reason instanceof Error ? depositsRes.reason.message : String(depositsRes.reason),
      })
    }

    if (withdrawalsRes.status === "fulfilled") {
      withdrawalSuccess = true
      const withdrawals = withdrawalsRes.value as unknown as Record<string, unknown>[]
      transactions.push(...withdrawals.map((w) => mapCcxtTransaction(w, "withdrawal", exchangeId, label)))
    } else {
      failedAccountCalls += 1
      console.warn("[exchange-client][E9102_COINBASE_WITHDRAWALS_ACCOUNT_FAILED]", {
        exchangeId,
        accountId,
        error: withdrawalsRes.reason instanceof Error ? withdrawalsRes.reason.message : String(withdrawalsRes.reason),
      })
    }
  }

  const warningParts: string[] = []
  if (accountIds.length > limitedAccountIds.length) {
    warningParts.push(`Queried first ${limitedAccountIds.length} of ${accountIds.length} Coinbase accounts`)
  }
  if (failedAccountCalls > 0) {
    warningParts.push(`Partial Coinbase transfer fetch failures (${failedAccountCalls}/${totalAccountCalls} account calls failed)`)
  }
  const warning = warningParts.length > 0 ? warningParts.join("; ") : undefined

  return {
    transactions: dedupeTransactions(transactions),
    depositOk: depositSuccess,
    withdrawalOk: withdrawalSuccess,
    ...(warning ? { warning } : {}),
  }
}

async function fetchTradesForExchange(
  exchange: Exchange,
  exchangeId: string,
  label: string,
): Promise<{ trades: ExchangeTransaction[]; ok: boolean; warning?: string }> {
  if (!exchange.has.fetchMyTrades && !exchange.has.fetchClosedOrders) {
    return { trades: [], ok: false, warning: "Trade history not supported by exchange API" }
  }

  if (exchange.has.fetchMyTrades) {
    try {
      const rawTrades = await exchange.fetchMyTrades(undefined, undefined, FETCH_LIMIT)
      const mapped = (rawTrades as unknown as Record<string, unknown>[])
        .map((trade) => mapCcxtTrade(trade, exchangeId, label))
        .filter((trade) => Number.isFinite(trade.amount) && trade.amount > 0 && !!trade.currency)
      return { trades: dedupeTransactions(mapped), ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const requiresSymbol = message.toLowerCase().includes("requires a symbol")
      if (!requiresSymbol || !exchange.has.fetchClosedOrders) {
        return { trades: [], ok: false, warning: `Trade history fetch failed: ${message}` }
      }
      console.info("[exchange-client][E9103_TRADES_FALLBACK_TO_CLOSED_ORDERS]", {
        exchangeId,
        reason: message,
      })
    }
  }

  if (exchange.has.fetchClosedOrders) {
    try {
      const rawOrders = await exchange.fetchClosedOrders(undefined, undefined, FETCH_LIMIT)
      const mapped = (rawOrders as unknown as Record<string, unknown>[])
        .map((order) => mapClosedOrderToTrade(order, exchangeId, label))
        .filter((trade): trade is ExchangeTransaction => Boolean(trade))
        .filter((trade) => !!trade.currency)
      return { trades: dedupeTransactions(mapped), ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { trades: [], ok: false, warning: `Closed-order trade fallback failed: ${message}` }
    }
  }

  return { trades: [], ok: false, warning: "Trade history fetch is not available" }
}

/** Fetch deposit + withdrawal + trade history from all connected exchanges */
export async function fetchExchangeTransactions(
  exchangeCredentials: { exchangeId: string; credentials: ExchangeCredentials }[],
): Promise<AllExchangeTransactionsResult> {
  if (exchangeCredentials.length === 0) {
    return { transactions: [], capabilities: [] }
  }

  const settledResults = await Promise.allSettled(
    exchangeCredentials.map(async ({ exchangeId, credentials }) => {
      const def = getExchangeById(exchangeId)
      const label = def?.label || exchangeId

      if (!def) {
        return {
          transactions: [] as ExchangeTransaction[],
          capability: {
            id: exchangeId,
            label,
            supportsDeposits: false,
            supportsWithdrawals: false,
            supportsTrades: false,
            error: "Unknown exchange",
          } as ExchangeCapability,
        }
      }

      try {
        const exchange = createExchange(def.ccxtId, credentials)
        const supportsDeposits = !!exchange.has.fetchDeposits
        const supportsWithdrawals = !!exchange.has.fetchWithdrawals
        const supportsTrades = !!exchange.has.fetchMyTrades || !!exchange.has.fetchClosedOrders

        const capability: ExchangeCapability = {
          id: exchangeId,
          label,
          supportsDeposits,
          supportsWithdrawals,
          supportsTrades,
        }
        const transactions: ExchangeTransaction[] = []
        const failedParts: string[] = []
        const requestedParts: string[] = []

        if (exchangeId === "coinbase" && (supportsDeposits || supportsWithdrawals)) {
          requestedParts.push("deposits", "withdrawals")
          try {
            const coinbaseTransfers = await fetchCoinbaseTransfers(exchange, exchangeId, label)
            transactions.push(...coinbaseTransfers.transactions)
            if (!coinbaseTransfers.depositOk) failedParts.push("deposits")
            if (!coinbaseTransfers.withdrawalOk) failedParts.push("withdrawals")
            if (coinbaseTransfers.warning) {
              console.warn("[exchange-client][E9104_COINBASE_TRANSFER_WARNING]", {
                exchangeId,
                warning: coinbaseTransfers.warning,
              })
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            failedParts.push("deposits", "withdrawals")
            console.error("[exchange-client][E9105_COINBASE_TRANSFER_FETCH_FAILED]", {
              exchangeId,
              error: message,
            })
          }
        } else {
          if (supportsDeposits) {
            requestedParts.push("deposits")
            try {
              const deposits = await fetchAllPaginated(exchange, "fetchDeposits")
              const mapped = (deposits as Record<string, unknown>[]).map((d) =>
                mapCcxtTransaction(d, "deposit", exchangeId, label)
              )
              transactions.push(...mapped)
            } catch (error) {
              failedParts.push("deposits")
              console.error("[exchange-client][E9106_EXCHANGE_DEPOSITS_FETCH_FAILED]", {
                exchangeId,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }

          if (supportsWithdrawals) {
            requestedParts.push("withdrawals")
            try {
              const withdrawals = await fetchAllPaginated(exchange, "fetchWithdrawals")
              const mapped = (withdrawals as Record<string, unknown>[]).map((w) =>
                mapCcxtTransaction(w, "withdrawal", exchangeId, label)
              )
              transactions.push(...mapped)
            } catch (error) {
              failedParts.push("withdrawals")
              console.error("[exchange-client][E9107_EXCHANGE_WITHDRAWALS_FETCH_FAILED]", {
                exchangeId,
                error: error instanceof Error ? error.message : String(error),
              })
            }
          }
        }

        if (supportsTrades) {
          requestedParts.push("trades")
          const tradeResult = await fetchTradesForExchange(exchange, exchangeId, label)
          if (tradeResult.ok) {
            transactions.push(...tradeResult.trades)
          } else {
            failedParts.push("trades")
            console.warn("[exchange-client][E9108_EXCHANGE_TRADES_FETCH_FAILED]", {
              exchangeId,
              warning: tradeResult.warning ?? "Failed to fetch trades",
            })
          }
        }

        const dedupedTransactions = dedupeTransactions(
          transactions.filter((tx) =>
            Number.isFinite(tx.amount)
            && tx.amount > 0
            && !!tx.currency
            && Number.isFinite(tx.timestamp)
          )
        )

        const hardFailure = requestedParts.length > 0 && failedParts.length >= requestedParts.length

        return {
          transactions: dedupedTransactions,
          capability: hardFailure
            ? { ...capability, error: `Failed to fetch ${failedParts.join(" and ")}` }
            : capability,
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error"
        console.error("[exchange-client][E9109_EXCHANGE_HISTORY_FETCH_FAILED]", {
          exchangeId,
          error: errMsg,
        })
        return {
          transactions: [] as ExchangeTransaction[],
          capability: {
            id: exchangeId,
            label,
            supportsDeposits: false,
            supportsWithdrawals: false,
            supportsTrades: false,
            error: errMsg,
          } satisfies ExchangeCapability,
        }
      }
    })
  )

  const allTransactions: ExchangeTransaction[] = []
  const allCapabilities: ExchangeCapability[] = []
  for (let i = 0; i < settledResults.length; i++) {
    const result = settledResults[i]
    if (result.status === "fulfilled") {
      allTransactions.push(...result.value.transactions)
      allCapabilities.push(result.value.capability)
      continue
    }

    const exchangeId = exchangeCredentials[i]?.exchangeId ?? "unknown"
    const def = getExchangeById(exchangeId)
    const error = result.reason instanceof Error ? result.reason.message : "Unexpected exchange history failure"
    console.error("[exchange-client][E9110_EXCHANGE_HISTORY_PROMISE_REJECTED]", {
      exchangeId,
      error,
    })
    allCapabilities.push({
      id: exchangeId,
      label: def?.label ?? exchangeId,
      supportsDeposits: false,
      supportsWithdrawals: false,
      supportsTrades: false,
      error,
    })
  }

  // Sort newest first
  allTransactions.sort((a, b) => b.timestamp - a.timestamp)

  return { transactions: allTransactions, capabilities: allCapabilities }
}
