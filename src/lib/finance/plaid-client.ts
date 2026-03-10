/**
 * Plaid SDK wrapper — barrel re-export.
 * Split into: plaid-types, plaid-transactions, plaid-products.
 */

export type {
  PlaidExchangeResult,
  PlaidAccount,
  PlaidTransaction,
  PlaidSyncResult,
  PlaidInstitution,
  PlaidItemInfo,
  PlaidIdentityOwner,
  PlaidIdentityAccount,
  PlaidRecurringStream,
} from "./plaid-types"

export {
  createLinkToken,
  exchangePublicToken,
  getAccounts,
  getBalances,
  removeItem,
  getItemInfo,
  getInstitution,
} from "./plaid-types"

export {
  syncTransactions,
  getTransactions,
  getRecurringTransactions,
} from "./plaid-transactions"

export type {
  PlaidLiabilities,
  PlaidInvestmentHolding,
  PlaidInvestmentSecurity,
  PlaidInvestmentTransaction,
} from "./plaid-products"

export {
  getIdentity,
  getLiabilities,
  getInvestmentHoldings,
  getInvestmentTransactions,
} from "./plaid-products"
