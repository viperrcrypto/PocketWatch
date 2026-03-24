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

/** Map from chain IDs (DB format + Zerion format) to Alchemy network IDs. */
const ALCHEMY_NETWORKS: Record<string, string> = {
  // DB format (uppercase short codes from TrackedWallet.chains)
  ETH: "eth-mainnet",
  ARBITRUM_ONE: "arb-mainnet",
  BASE: "base-mainnet",
  POLYGON_POS: "polygon-mainnet",
  BSC: "bnb-mainnet",
  OPTIMISM: "opt-mainnet",
  LINEA: "linea-mainnet",
  SCROLL: "scroll-mainnet",
  ZKSYNC: "zksync-mainnet",
  SOL: "solana-mainnet",
  // Zerion format (lowercase)
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

/** Alchemy tokens/by-address response: { data: { tokens: [...] } } */
interface AlchemyToken {
  address: string        // wallet address
  network: string        // e.g. "solana-mainnet", "eth-mainnet"
  tokenAddress: string | null  // contract (null for native)
  tokenBalance: string   // hex-encoded raw balance
  tokenMetadata: {
    symbol: string | null
    name: string | null
    decimals: number | null
    logo: string | null
  }
  tokenPrices: Array<{
    currency: string
    value: string
    lastUpdatedAt: string
  }>
}

interface AlchemyResponse {
  data: { tokens: AlchemyToken[] }
}

function normalizeAlchemyToken(t: AlchemyToken): ZerionPosition | null {
  // Skip tokens with no symbol — almost always spam/unknown
  if (!t.tokenMetadata.symbol) return null

  // Find USD price — skip tokens with no price data (can't value them)
  const usdPrice = t.tokenPrices.find((p) => p.currency === "usd")
  const price = usdPrice ? Number(usdPrice.value) : 0
  if (price <= 0) return null

  // Default decimals: 9 for Solana native, 18 for EVM — most common defaults
  const isSolana = t.network === "solana-mainnet"
  const decimals = t.tokenMetadata.decimals ?? (isSolana ? 9 : 18)
  const rawBalance = BigInt(t.tokenBalance || "0x0")
  const quantity = Number(rawBalance) / Math.pow(10, decimals)
  const value = quantity * price

  if (value <= 0 && quantity <= 0) return null

  const chain = ALCHEMY_TO_CHAIN[t.network] ?? t.network
  return {
    id: `alchemy-${chain}-${t.tokenAddress ?? "native"}`,
    symbol: t.tokenMetadata.symbol,
    name: t.tokenMetadata.name || "Unknown Token",
    chain,
    quantity,
    price,
    value,
    iconUrl: t.tokenMetadata.logo ?? null,
    positionType: "wallet",
    contractAddress: t.tokenAddress ?? null,
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
    const network = ALCHEMY_NETWORKS[chain]
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
    const tokens = Array.isArray(json.data?.tokens) ? json.data.tokens : []
    for (const t of tokens) {
      if (t.address.toLowerCase() !== address.toLowerCase()) continue
      const pos = normalizeAlchemyToken(t)
      if (pos) positions.push(pos)
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

  console.log(`[alchemy] Starting fetch for ${wallets.length} wallets`)

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

    // Progress logging every 20 wallets
    if ((i + BATCH_SIZE) % 20 === 0 || i + BATCH_SIZE >= wallets.length) {
      console.log(`[alchemy] Progress: ${Math.min(i + BATCH_SIZE, wallets.length)}/${wallets.length} wallets, ${results.length} succeeded`)
    }
  }

  const totalPositions = results.reduce((s, w) => s + w.positions.length, 0)
  console.log(`[alchemy] Complete: ${results.length}/${wallets.length} wallets, ${totalPositions} positions, ${failedCount} failed`)

  if (results.length === 0 && wallets.length > 0) {
    throw new Error(`All ${wallets.length} Alchemy wallet fetches failed`)
  }

  return { wallets: results, failedCount }
}
