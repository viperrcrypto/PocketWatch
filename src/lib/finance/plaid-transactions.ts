/**
 * Plaid transaction sync and history fetching.
 */

import { getPlaidClient } from "./plaid-types"
import type { PlaidTransaction, PlaidSyncResult } from "./plaid-types"

/** Map a raw Plaid transaction to our normalized shape */
function mapPlaidTransaction(t: any): PlaidTransaction {
  return {
    transactionId: t.transaction_id,
    accountId: t.account_id,
    date: t.date,
    authorizedDate: t.authorized_date ?? null,
    name: t.name,
    merchantName: t.merchant_name ?? null,
    merchantEntityId: t.merchant_entity_id ?? null,
    logoUrl: t.logo_url ?? null,
    website: t.website ?? null,
    amount: t.amount,
    isoCurrencyCode: t.iso_currency_code ?? null,
    pending: t.pending,
    category: null,
    personalFinanceCategory: t.personal_finance_category ?? null,
    paymentChannel: t.payment_channel ?? null,
    checkNumber: t.check_number ?? null,
    transactionCode: t.transaction_code ?? null,
    location: t.location ? {
      address: t.location.address ?? null, city: t.location.city ?? null,
      region: t.location.region ?? null, postalCode: t.location.postal_code ?? null,
      country: t.location.country ?? null, lat: t.location.lat ?? null,
      lon: t.location.lon ?? null, storeNumber: t.location.store_number ?? null,
    } : null,
    paymentMeta: t.payment_meta ? {
      referenceNumber: t.payment_meta.reference_number ?? null, ppdId: t.payment_meta.ppd_id ?? null,
      payee: t.payment_meta.payee ?? null, payer: t.payment_meta.payer ?? null,
      paymentMethod: t.payment_meta.payment_method ?? null,
      paymentProcessor: t.payment_meta.payment_processor ?? null,
      reason: t.payment_meta.reason ?? null,
    } : null,
    counterparties: t.counterparties?.map((c: any) => ({
      name: c.name, type: c.type, logoUrl: c.logo_url ?? null,
      website: c.website ?? null, entityId: c.entity_id ?? null,
      confidenceLevel: c.confidence_level ?? null,
    })) ?? null,
  }
}

export async function syncTransactions(
  userId: string,
  accessToken: string,
  cursor?: string | null
): Promise<PlaidSyncResult> {
  const client = await getPlaidClient(userId)
  const response = await client.transactionsSync({
    access_token: accessToken,
    cursor: cursor ?? undefined,
    count: 500,
  })

  return {
    added: response.data.added.map(mapPlaidTransaction),
    modified: response.data.modified.map(mapPlaidTransaction),
    removed: response.data.removed.map((r) => r.transaction_id),
    nextCursor: response.data.next_cursor,
    hasMore: response.data.has_more,
  }
}

/**
 * Fetch historical transactions using transactionsGet (up to 2 years).
 * Unlike transactionsSync, this lets us specify an explicit date range.
 */
export async function getTransactions(
  userId: string,
  accessToken: string,
  startDate: string,
  endDate: string,
): Promise<{ transactions: PlaidTransaction[]; totalTransactions: number }> {
  const client = await getPlaidClient(userId)
  const allTransactions: PlaidTransaction[] = []
  let offset = 0
  const count = 500

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.transactionsGet({
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count, offset },
    })

    const mapped = response.data.transactions.map(mapPlaidTransaction)

    allTransactions.push(...mapped)
    const total = response.data.total_transactions
    offset += mapped.length
    if (offset >= total || mapped.length === 0) break
  }

  return { transactions: allTransactions, totalTransactions: allTransactions.length }
}

export async function getRecurringTransactions(
  userId: string,
  accessToken: string,
  accountIds: string[],
): Promise<{ inflowStreams: import("./plaid-types").PlaidRecurringStream[]; outflowStreams: import("./plaid-types").PlaidRecurringStream[] }> {
  const client = await getPlaidClient(userId)
  const response = await client.transactionsRecurringGet({
    access_token: accessToken,
    account_ids: accountIds,
  })
  const mapStream = (s: any): import("./plaid-types").PlaidRecurringStream => ({
    streamId: s.stream_id, accountId: s.account_id,
    category: s.personal_finance_category?.primary ?? null,
    description: s.description ?? "", merchantName: s.merchant_name ?? null,
    firstDate: s.first_date ?? null, lastDate: s.last_date ?? null,
    frequency: s.frequency ?? "UNKNOWN",
    averageAmount: s.average_amount?.amount ?? null,
    lastAmount: s.last_amount?.amount ?? null,
    isActive: s.is_active ?? true, status: s.status ?? "MATURE",
    personalFinanceCategory: s.personal_finance_category ?? null,
    transactionIds: s.transaction_ids ?? [],
  })
  return {
    inflowStreams: (response.data.inflow_streams ?? []).map(mapStream),
    outflowStreams: (response.data.outflow_streams ?? []).map(mapStream),
  }
}
