/** Moralis Wallet API client — fetches EVM wallet token balances with USD values. */

import type { ZerionPosition, ZerionWalletData, MultiWalletResult } from "./zerion-client"

const TIMEOUT_MS = 30_000
const BATCH_SIZE = 3

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Map from chain IDs (DB format + Zerion format) to Moralis chain parameter. */
const MORALIS_CHAINS: Record<string, string> = {
  // DB format (uppercase short codes from TrackedWallet.chains)
  ETH: "eth",
  POLYGON_POS: "polygon",
  BSC: "bsc",
  ARBITRUM_ONE: "arbitrum",
  BASE: "base",
  OPTIMISM: "optimism",
  LINEA: "linea",
  SCROLL: "scroll",
  // Zerion format (lowercase)
  ethereum: "eth",
  polygon: "polygon",
  "binance-smart-chain": "bsc",
  arbitrum: "arbitrum",
  base: "base",
  optimism: "optimism",
  linea: "linea",
  scroll: "scroll",
}

/** Reverse map: Moralis chain → internal chain ID. */
const MORALIS_TO_CHAIN: Record<string, string> = {}
for (const [chain, moralisId] of Object.entries(MORALIS_CHAINS)) {
  MORALIS_TO_CHAIN[moralisId] = chain
}

interface MoralisToken {
  token_address: string
  symbol: string
  name: string
  logo: string | null
  balance: string
  decimals: number
  usd_value: number | null
  usd_price: number | null
  native_token: boolean
  portfolio_percentage: number
}

function normalizePosition(token: MoralisToken, chain: string): ZerionPosition {
  const quantity = Number(token.balance) / Math.pow(10, token.decimals)
  const value = token.usd_value ?? 0
  const price = token.usd_price ?? (quantity > 0 ? value / quantity : 0)
  const internalChain = MORALIS_TO_CHAIN[chain] ?? chain

  return {
    id: `moralis-${internalChain}-${token.token_address}`,
    symbol: token.symbol || "???",
    name: token.name || "Unknown Token",
    chain: internalChain,
    quantity,
    price,
    value,
    iconUrl: token.logo ?? null,
    positionType: "wallet",
    contractAddress: token.native_token ? null : token.token_address,
    protocol: null,
    protocolIcon: null,
    protocolUrl: null,
    isDefi: false,
  }
}

/** Convert internal chain names to Moralis chain IDs, filtering unsupported chains. */
function toMoralisChains(chains: string[]): string[] {
  const result: string[] = []
  for (const chain of chains) {
    const moralisChain = MORALIS_CHAINS[chain]
    if (moralisChain) result.push(moralisChain)
  }
  return result
}

/** Fetch all token balances for a single wallet across specified chains. */
export async function fetchMoralisBalances(
  apiKey: string,
  address: string,
  chains: string[],
): Promise<ZerionPosition[]> {
  const moralisChains = toMoralisChains(chains)
  if (moralisChains.length === 0) return []

  const positions: ZerionPosition[] = []

  for (const chain of moralisChains) {
    const url =
      `https://deep-index.moralis.io/api/v2.2/wallets/${encodeURIComponent(address)}/tokens` +
      `?chain=${chain}&exclude_spam=true`

    const res = await fetch(url, {
      headers: { "X-API-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      if (res.status === 429) throw Object.assign(new Error("Moralis rate limit exceeded"), { status: 429 })
      if (res.status === 401) throw new Error("Invalid Moralis API key")
      throw new Error(`Moralis API error: ${res.status} ${body.slice(0, 200)}`)
    }

    const json: { result: MoralisToken[] } = await res.json()
    for (const token of json.result ?? []) {
      if ((token.usd_value ?? 0) <= 0 && Number(token.balance) <= 0) continue
      positions.push(normalizePosition(token, chain))
    }
  }

  return positions
}

/** Fetch balances for multiple wallets with controlled concurrency. */
export async function fetchMultiMoralisBalances(
  apiKey: string,
  wallets: Array<{ address: string; chains: string[] }>,
): Promise<MultiWalletResult> {
  const results: ZerionWalletData[] = []
  let failedCount = 0

  for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
    const batch = wallets.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async (w) => {
        const positions = await fetchMoralisBalances(apiKey, w.address, w.chains)
        return {
          address: w.address,
          totalValue: positions.reduce((sum, p) => sum + p.value, 0),
          positions,
        }
      }),
    )

    for (let j = 0; j < settled.length; j++) {
      const result = settled[j]
      if (result.status === "fulfilled") {
        results.push(result.value)
      } else {
        failedCount++
        console.warn(`[moralis] Wallet ${batch[j].address.slice(0, 8)}… failed: ${result.reason?.message}`)
        if (result.reason?.status === 429) throw result.reason
      }
    }

    if (i + BATCH_SIZE < wallets.length) await sleep(50)
  }

  if (results.length === 0 && wallets.length > 0) {
    throw new Error(`All ${wallets.length} Moralis wallet fetches failed`)
  }

  return { wallets: results, failedCount }
}
