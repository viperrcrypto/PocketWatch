/** Alchemy Portfolio API client — fetches EVM + Solana balances via token-by-address endpoint. */

import { withProviderPermit } from "./provider-governor"
import type { ZerionPosition, ZerionWalletData, MultiWalletResult } from "./zerion-client"

const TIMEOUT_MS = 30_000
const MAX_ADDRESSES_PER_REQ = 2
const MAX_NETWORKS_PER_REQ = 5
const BATCH_SIZE = 2

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Map from Zerion/internal chain IDs to Alchemy network IDs. */
const ALCHEMY_NETWORKS: Record<string, string> = {
  ethereum: "eth-mainnet",
  arbitrum: "arb-mainnet",
  base: "base-mainnet",
  polygon: "polygon-mainnet",
  "binance-smart-chain": "bnb-mainnet",
  optimism: "opt-mainnet",
  linea: "linea-mainnet",
  scroll: "scroll-mainnet",
  "zksync-era": "zksync-mainnet",
  solana: "solana-mainnet",
}

/** Reverse map: Alchemy network ID → Zerion chain ID. */
const ALCHEMY_TO_CHAIN: Record<string, string> = {}
for (const [chain, network] of Object.entries(ALCHEMY_NETWORKS)) {
  ALCHEMY_TO_CHAIN[network] = chain
}

interface AlchemyTokenBalance {
  token: {
    symbol: string
    name: string
    decimals: number
    logo: string | null
    address: string | null
    network: string
  }
  value: string
  valueUsd: number
}

interface AlchemyAddressResult {
  address: string
  tokenBalances: AlchemyTokenBalance[]
}

interface AlchemyResponse {
  data: AlchemyAddressResult[]
}

function normalizeAlchemyPosition(tb: AlchemyTokenBalance): ZerionPosition {
  const decimals = tb.token.decimals ?? 18
  const rawValue = Number(tb.value || "0")
  const quantity = rawValue / Math.pow(10, decimals)
  const value = tb.valueUsd ?? 0
  const price = quantity > 0 ? value / quantity : 0
  const chain = ALCHEMY_TO_CHAIN[tb.token.network] ?? tb.token.network

  return {
    id: `alchemy-${chain}-${tb.token.address ?? "native"}`,
    symbol: tb.token.symbol || "???",
    name: tb.token.name || "Unknown Token",
    chain,
    quantity,
    price,
    value,
    iconUrl: tb.token.logo ?? null,
    positionType: "wallet",
    contractAddress: tb.token.address ?? null,
    protocol: null,
    protocolIcon: null,
    protocolUrl: null,
    isDefi: false,
  }
}

/** Convert internal chain names to Alchemy network IDs, filtering unsupported chains. */
function toAlchemyNetworks(chains: string[]): string[] {
  const networks: string[] = []
  for (const chain of chains) {
    const network = ALCHEMY_NETWORKS[chain.toLowerCase()]
    if (network) networks.push(network)
  }
  return networks
}

/** Fetch balances for a single wallet across specified networks. */
export async function fetchAlchemyBalances(
  apiKey: string,
  address: string,
  chains: string[],
): Promise<ZerionPosition[]> {
  const networks = toAlchemyNetworks(chains)
  if (networks.length === 0) return []

  const positions: ZerionPosition[] = []

  // Chunk networks into groups of MAX_NETWORKS_PER_REQ
  for (let i = 0; i < networks.length; i += MAX_NETWORKS_PER_REQ) {
    const networkChunk = networks.slice(i, i + MAX_NETWORKS_PER_REQ)
    const url = `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/by-address`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addresses: [{ address, networks: networkChunk }],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "")
      if (res.status === 429) throw Object.assign(new Error("Alchemy rate limit exceeded"), { status: 429 })
      if (res.status === 401 || res.status === 403) throw new Error("Invalid Alchemy API key")
      throw new Error(`Alchemy API error: ${res.status} ${body.slice(0, 200)}`)
    }

    const json: AlchemyResponse = await res.json()
    for (const addrResult of json.data ?? []) {
      for (const tb of addrResult.tokenBalances ?? []) {
        if (tb.valueUsd <= 0) continue
        positions.push(normalizeAlchemyPosition(tb))
      }
    }
  }

  return positions
}

/** Fetch balances for multiple wallets with controlled concurrency. */
export async function fetchMultiAlchemyBalances(
  apiKey: string,
  wallets: Array<{ address: string; chains: string[] }>,
): Promise<MultiWalletResult> {
  const results: ZerionWalletData[] = []
  let failedCount = 0

  for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
    const batch = wallets.slice(i, i + BATCH_SIZE)
    const settled = await Promise.allSettled(
      batch.map(async (w) => {
        const positions = await fetchAlchemyBalances(apiKey, w.address, w.chains)
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
        console.warn(`[alchemy] Wallet ${batch[j].address.slice(0, 8)}… failed: ${result.reason?.message}`)
        if (result.reason?.status === 429) throw result.reason
      }
    }

    if (i + BATCH_SIZE < wallets.length) await sleep(50)
  }

  if (results.length === 0 && wallets.length > 0) {
    throw new Error(`All ${wallets.length} Alchemy wallet fetches failed`)
  }

  return { wallets: results, failedCount }
}
