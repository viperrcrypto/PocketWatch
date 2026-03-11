/**
 * Plaid SDK types and client factory.
 */

import {
  Configuration,
  PlaidApi,
  Products,
  CountryCode,
} from "plaid"
import { db } from "@/lib/db"
import { decryptCredential } from "./crypto"

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: "https://sandbox.plaid.com",
  development: "https://production.plaid.com",
  production: "https://production.plaid.com",
}

// ─── Factory ────────────────────────────────────────────────────

export async function getPlaidClient(userId: string): Promise<PlaidApi> {
  let clientId = ""
  let secret = ""
  let env = "sandbox"

  // 1. Try DB credentials (encrypted, user-specific)
  const cred = await db.financeCredential.findUnique({
    where: { userId_service: { userId, service: "plaid" } },
  })

  if (cred) {
    clientId = await decryptCredential(cred.encryptedKey)
    secret = await decryptCredential(cred.encryptedSecret)
    env = cred.environment
  } else {
    // 2. Fallback to env vars
    clientId = process.env.PLAID_CLIENT_ID ?? ""
    secret = process.env.PLAID_SECRET ?? ""
    env = process.env.PLAID_ENV ?? "sandbox"
  }

  if (!clientId || !secret) {
    throw new Error("Plaid credentials not configured. Add them in Finance Settings.")
  }

  const configuration = new Configuration({
    basePath: PLAID_BASE_URLS[env] ?? PLAID_BASE_URLS.sandbox,
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": clientId,
        "PLAID-SECRET": secret,
      },
    },
  })

  return new PlaidApi(configuration)
}

// ─── Shared Types ────────────────────────────────────────────────

export interface PlaidExchangeResult {
  accessToken: string
  itemId: string
}

export interface PlaidAccount {
  accountId: string
  name: string
  officialName: string | null
  type: string
  subtype: string | null
  mask: string | null
  balances: {
    current: number | null
    available: number | null
    limit: number | null
    isoCurrencyCode: string | null
  }
}

export interface PlaidTransaction {
  transactionId: string
  accountId: string
  date: string
  authorizedDate: string | null
  name: string
  merchantName: string | null
  merchantEntityId: string | null
  logoUrl: string | null
  website: string | null
  amount: number
  isoCurrencyCode: string | null
  pending: boolean
  category: string | null
  personalFinanceCategory: { primary: string; detailed: string } | null
  paymentChannel: string | null
  checkNumber: string | null
  transactionCode: string | null
  location: {
    address: string | null; city: string | null; region: string | null
    postalCode: string | null; country: string | null
    lat: number | null; lon: number | null; storeNumber: string | null
  } | null
  paymentMeta: {
    referenceNumber: string | null; ppdId: string | null
    payee: string | null; payer: string | null
    paymentMethod: string | null; paymentProcessor: string | null; reason: string | null
  } | null
  counterparties: Array<{
    name: string; type: string; logoUrl: string | null
    website: string | null; entityId: string | null; confidenceLevel: string | null
  }> | null
}

export interface PlaidSyncResult {
  added: PlaidTransaction[]
  modified: PlaidTransaction[]
  removed: string[]
  nextCursor: string
  hasMore: boolean
}

export interface PlaidInstitution {
  institutionId: string
  name: string
  logo: string | null
  primaryColor: string | null
}

export interface PlaidItemInfo {
  itemId: string
  institutionId: string | null
  availableProducts: string[]
  billedProducts: string[]
  consentExpirationTime: string | null
}

export interface PlaidIdentityOwner {
  names: string[]
  emails: Array<{ data: string; primary: boolean; type: string }>
  phoneNumbers: Array<{ data: string; primary: boolean; type: string }>
  addresses: Array<{
    data: { street: string | null; city: string | null; region: string | null; postalCode: string | null; country: string | null }
    primary: boolean
  }>
}

export interface PlaidIdentityAccount {
  accountId: string
  owners: PlaidIdentityOwner[]
}

export interface PlaidRecurringStream {
  streamId: string; accountId: string; category: string | null
  description: string; merchantName: string | null
  firstDate: string | null; lastDate: string | null; frequency: string
  averageAmount: number | null; lastAmount: number | null
  isActive: boolean; status: string
  personalFinanceCategory: { primary: string; detailed: string } | null
  transactionIds: string[]
}

// ─── Core Functions ─────────────────────────────────────────────

export async function createLinkToken(userId: string): Promise<string> {
  const client = await getPlaidClient(userId)
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: "PocketWatch",
    products: [Products.Transactions],
    optional_products: [
      Products.Liabilities,
      Products.Investments,
      Products.Identity,
    ],
    transactions: { days_requested: 730 },
    country_codes: [CountryCode.Us],
    language: "en",
  })
  return response.data.link_token
}

export async function exchangePublicToken(
  userId: string,
  publicToken: string
): Promise<PlaidExchangeResult> {
  const client = await getPlaidClient(userId)
  const response = await client.itemPublicTokenExchange({
    public_token: publicToken,
  })
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  }
}

export async function getAccounts(
  userId: string,
  accessToken: string
): Promise<PlaidAccount[]> {
  const client = await getPlaidClient(userId)
  const response = await client.accountsGet({ access_token: accessToken })
  return response.data.accounts.map((a) => ({
    accountId: a.account_id,
    name: a.name,
    officialName: a.official_name,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    balances: {
      current: a.balances.current,
      available: a.balances.available,
      limit: a.balances.limit,
      isoCurrencyCode: a.balances.iso_currency_code,
    },
  }))
}

export async function getBalances(
  userId: string,
  accessToken: string
): Promise<PlaidAccount[]> {
  const client = await getPlaidClient(userId)
  const response = await client.accountsBalanceGet({
    access_token: accessToken,
  })
  return response.data.accounts.map((a) => ({
    accountId: a.account_id,
    name: a.name,
    officialName: a.official_name,
    type: a.type,
    subtype: a.subtype,
    mask: a.mask,
    balances: {
      current: a.balances.current,
      available: a.balances.available,
      limit: a.balances.limit,
      isoCurrencyCode: a.balances.iso_currency_code,
    },
  }))
}

export async function removeItem(
  userId: string,
  accessToken: string
): Promise<void> {
  const client = await getPlaidClient(userId)
  await client.itemRemove({ access_token: accessToken })
}

export async function getItemInfo(
  userId: string,
  accessToken: string
): Promise<PlaidItemInfo> {
  const client = await getPlaidClient(userId)
  const response = await client.itemGet({ access_token: accessToken })
  const item = response.data.item
  return {
    itemId: item.item_id,
    institutionId: item.institution_id ?? null,
    availableProducts: (item.available_products ?? []) as string[],
    billedProducts: (item.billed_products ?? []) as string[],
    consentExpirationTime: item.consent_expiration_time ?? null,
  }
}

export async function getInstitution(
  userId: string,
  institutionId: string
): Promise<PlaidInstitution> {
  const client = await getPlaidClient(userId)
  const response = await client.institutionsGetById({
    institution_id: institutionId,
    country_codes: [CountryCode.Us],
    options: { include_optional_metadata: true },
  })
  const inst = response.data.institution
  return {
    institutionId: inst.institution_id,
    name: inst.name,
    logo: inst.logo ?? null,
    primaryColor: inst.primary_color ?? null,
  }
}
