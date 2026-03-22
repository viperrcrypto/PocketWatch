/** Helius Wallet API client — fetches Solana wallet balances with USD prices. */

import { withProviderPermit } from "./provider-governor"
import type { ZerionPosition, ZerionWalletData, MultiWalletResult } from "./zerion-client"

const TIMEOUT_MS = 30_000
const BATCH_SIZE = 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

interface HeliusToken {
  mint: string
  amount: number
  decimals: number
  name: string
  symbol: string
  logoURI: string | null
  valueUsd: number
}

interface HeliusBalanceResponse {
  nativeBalance: { lamports: number; solPrice: number }
  tokens: HeliusToken[]
  totalUsdValue: number
}

function normalizeHeliusPosition(token: HeliusToken): ZerionPosition {
  const quantity = token.amount
  const price = quantity > 0 ? token.valueUsd / quantity : 0
  return {
    id: `helius-sol-${token.mint}`,
    symbol: token.symbol || "???",
    name: token.name || "Unknown Token",
    chain: "solana",
    quantity,
    price,
    value: token.valueUsd,
    iconUrl: token.logoURI ?? null,
    positionType: "wallet",
    contractAddress: token.mint,
    protocol: null,
    protocolIcon: null,
    protocolUrl: null,
    isDefi: false,
  }
}

/** Fetch all token balances for a single Solana wallet via Helius. */
export async function fetchHeliusBalances(
  apiKey: string,
  address: string,
): Promise<ZerionPosition[]> {
  const positions: ZerionPosition[] = []
  let page = 1
  let hasMore = true

  while (hasMore) {
    const url = `https://api.helius.xyz/v1/wallet/${encodeURIComponent(address)}/balances?api-key=${apiKey}&page=${page}`
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      if (res.status === 429) throw Object.assign(new Error("Helius rate limit exceeded"), { status: 429 })
      if (res.status === 401) throw new Error("Invalid Helius API key")
      throw new Error(`Helius API error: ${res.status} ${body.slice(0, 200)}`)
    }

    const json: HeliusBalanceResponse & { hasMore?: boolean } = await res.json()

    // Native SOL balance
    if (page === 1 && json.nativeBalance && json.nativeBalance.lamports > 0) {
      const solQty = json.nativeBalance.lamports / 1e9
      const solPrice = json.nativeBalance.solPrice ?? 0
      positions.push({
        id: `helius-sol-native-${address.slice(0, 8)}`,
        symbol: "SOL",
        name: "Solana",
        chain: "solana",
        quantity: solQty,
        price: solPrice,
        value: solQty * solPrice,
        iconUrl: null,
        positionType: "wallet",
        contractAddress: null,
        protocol: null,
        protocolIcon: null,
        protocolUrl: null,
        isDefi: false,
      })
    }

    // SPL tokens
    for (const token of json.tokens ?? []) {
      if (token.amount <= 0 && token.valueUsd <= 0) continue
      positions.push(normalizeHeliusPosition(token))
    }

    hasMore = json.hasMore === true
    page++
  }

  return positions
}

/** Fetch balances for multiple Solana wallets with controlled concurrency. */
export async function fetchMultiHeliusBalances(
  apiKey: string,
  addresses: string[],
): Promise<MultiWalletResult> {
  const wallets: ZerionWalletData[] = []
  let failedCount = 0

  for (let i = 0; i < addresses.length; i += BATCH_SIZE) {
    const batch = addresses.slice(i, i + BATCH_SIZE)
    const results = await Promise.allSettled(
      batch.map(async (address) => {
        const positions = await fetchHeliusBalances(apiKey, address)
        return {
          address,
          totalValue: positions.reduce((sum, p) => sum + p.value, 0),
          positions,
        }
      }),
    )

    for (let j = 0; j < results.length; j++) {
      const result = results[j]
      if (result.status === "fulfilled") {
        wallets.push(result.value)
      } else {
        failedCount++
        console.warn(`[helius] Wallet ${batch[j].slice(0, 8)}… failed: ${result.reason?.message}`)
        if (result.reason?.status === 429) throw result.reason // bubble up 429 for fallback
      }
    }

    if (i + BATCH_SIZE < addresses.length) await sleep(50)
  }

  if (wallets.length === 0 && addresses.length > 0) {
    throw new Error(`All ${addresses.length} Helius wallet fetches failed`)
  }

  return { wallets, failedCount }
}
