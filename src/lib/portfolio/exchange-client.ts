/**
 * CCXT-based exchange client — barrel re-export.
 * Split into: exchange-types, exchange-validation, exchange-balances, exchange-transactions.
 */

export type {
  ExchangeCredentials,
  ExchangeBalance,
  ExchangeSummary,
  AllExchangeBalancesResult,
  ExchangeTransaction,
  ExchangeCapability,
  AllExchangeTransactionsResult,
} from "./exchange-types"

export { createExchange } from "./exchange-types"
export { validateExchangeCredentials } from "./exchange-validation"
export { fetchExchangeBalances, fetchAllExchangeBalances } from "./exchange-balances"
export { fetchExchangeTransactions } from "./exchange-transactions"
