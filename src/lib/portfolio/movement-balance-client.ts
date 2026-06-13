/**
 * Movement (Aptos/Move L2) balance client.
 *
 * Movement has no Zerion/Alchemy/Moralis coverage, so this fetches directly:
 *  - Wallet token balances  → Movement Aptos indexer (current_fungible_asset_balances)
 *  - DEX LP positions (Yuzu) → Yuzu API liquidity-activity, netted per position
 *  - Prices                  → Yuzu /v1/top-tokens (covers Movement-native tokens)
 *
 * Yuzu exposes NO "current LP position value" endpoint and its positions are
 * Uniswap-V3-style concentrated liquidity, so open-position value is reconstructed
 * as net (deposited − withdrawn) USD at current prices. This is exact for
 * stablecoin pairs (no price drift / negligible IL) and approximate otherwise.
 *
 * Returns the same normalized ZerionPosition[] shape as every other provider, so
 * Movement flows through the cache, net worth, chain distribution, and LP UI
 * with no special-casing downstream.
 */

import type { ZerionPosition, ZerionWalletData, MultiWalletResult } from "./zerion-client"

const MOVEMENT_INDEXER = "https://indexer.mainnet.movementnetwork.xyz/v1/graphql"
const YUZU_API = "https://mainnet-api.yuzu.finance"
const REQUEST_TIMEOUT_MS = 20_000
const DUST_USD = 0.01

interface YuzuToken { symbol: string; type: string; price: string; decimals: number; iconUrl?: string }
interface FaBalance { amount: string; asset_type: string; metadata: { name: string; symbol: string; decimals: number } | null }
interface LpEvent {
  type: "add" | "remove"
  positionId: string
  poolAddress: string
  liquidity: string
  amount0: string
  amount1: string
  token0: { symbol: string; iconUrl?: string } | null
  token1: { symbol: string; iconUrl?: string } | null
}

/** Price map keyed by uppercase symbol (Yuzu top-tokens covers Movement assets). */
export async function fetchYuzuPrices(): Promise<Map<string, YuzuToken>> {
  const res = await fetch(`${YUZU_API}/v1/top-tokens?page=1&pageSize=100`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Yuzu top-tokens HTTP ${res.status}`)
  const json = (await res.json()) as { data: YuzuToken[] }
  const map = new Map<string, YuzuToken>()
  for (const t of json.data ?? []) {
    if (t.symbol) map.set(t.symbol.toUpperCase(), t)
  }
  return map
}

function priceFor(prices: Map<string, YuzuToken>, symbol: string | null | undefined): number {
  if (!symbol) return 0
  const t = prices.get(symbol.toUpperCase())
  const p = t ? Number(t.price) : 0
  return Number.isFinite(p) ? p : 0
}

/** Wallet fungible-asset balances via the Movement Aptos indexer. */
async function fetchWalletTokens(address: string, prices: Map<string, YuzuToken>): Promise<ZerionPosition[]> {
  const query = {
    query: `query($a:String!){ current_fungible_asset_balances(where:{owner_address:{_eq:$a}}, limit:200){ amount asset_type metadata{ name symbol decimals } } }`,
    variables: { a: address },
  }
  const res = await fetch(MOVEMENT_INDEXER, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    const e = new Error(`Movement indexer HTTP ${res.status}`)
    if (res.status === 429) Object.assign(e, { status: 429 })
    throw e
  }
  const json = (await res.json()) as { data?: { current_fungible_asset_balances?: FaBalance[] } }
  const balances = json.data?.current_fungible_asset_balances ?? []

  const positions: ZerionPosition[] = []
  for (const b of balances) {
    const meta = b.metadata
    if (!meta || !meta.symbol) continue
    const decimals = meta.decimals ?? 8
    const quantity = Number(b.amount) / 10 ** decimals
    if (!(quantity > 0)) continue
    const price = priceFor(prices, meta.symbol)
    const value = quantity * price
    // Skip unpriceable airdrop spam (no Yuzu price) and dust.
    if (value < DUST_USD) continue
    positions.push({
      id: `movement-${address.slice(0, 8)}-${b.asset_type}`,
      symbol: meta.symbol,
      name: meta.name || meta.symbol,
      chain: "movement",
      quantity,
      price,
      value,
      iconUrl: prices.get(meta.symbol.toUpperCase())?.iconUrl ?? null,
      positionType: "wallet",
      contractAddress: b.asset_type,
      protocol: null,
      protocolIcon: null,
      protocolUrl: null,
      isDefi: false,
    })
  }
  return positions
}

/** Open Yuzu LP positions, valued by net deposited USD (exact for stable pairs). */
async function fetchYuzuLpPositions(address: string, prices: Map<string, YuzuToken>): Promise<ZerionPosition[]> {
  const events: LpEvent[] = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${YUZU_API}/v1/profile/${address}/liquidity-activity?page=${page}&pageSize=50`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) break
    const json = (await res.json()) as { data?: { items?: LpEvent[]; totalItems?: number } }
    const items = json.data?.items ?? []
    events.push(...items)
    if (items.length === 0 || events.length >= (json.data?.totalItems ?? 0)) break
  }

  // Net each position: liquidity (to detect still-open) and deposited USD.
  const byPosition = new Map<string, { netLiq: bigint; usd: number; t0: string; t1: string; pool: string; icon0: string | null; icon1: string | null }>()
  for (const ev of events) {
    const s0 = ev.token0?.symbol ?? "?"
    const s1 = ev.token1?.symbol ?? "?"
    const usd = Number(ev.amount0) * priceFor(prices, s0) + Number(ev.amount1) * priceFor(prices, s1)
    const key = `${ev.positionId}@${ev.poolAddress}`
    const cur = byPosition.get(key) ?? { netLiq: 0n, usd: 0, t0: s0, t1: s1, pool: ev.poolAddress, icon0: ev.token0?.iconUrl ?? null, icon1: ev.token1?.iconUrl ?? null }
    const sign = ev.type === "add" ? 1 : -1
    cur.netLiq += BigInt(sign) * BigInt(ev.liquidity || "0")
    cur.usd += sign * usd
    byPosition.set(key, cur)
  }

  const positions: ZerionPosition[] = []
  for (const [key, p] of byPosition) {
    if (p.netLiq <= 0n || p.usd < DUST_USD) continue // closed or empty
    positions.push({
      id: `movement-yuzu-${key}`,
      symbol: `${p.t0}/${p.t1}`,
      name: `Yuzu ${p.t0}/${p.t1} LP`,
      chain: "movement",
      quantity: 1,
      price: p.usd,
      value: p.usd,
      iconUrl: p.icon0,
      positionType: "investment",
      contractAddress: p.pool,
      protocol: "Yuzu",
      protocolIcon: null,
      protocolUrl: "https://yuzu.finance",
      isDefi: true,
    })
  }
  return positions
}

/** All Movement positions (wallet tokens + Yuzu LP) for one address. */
export async function fetchMovementBalances(address: string, prices: Map<string, YuzuToken>): Promise<ZerionPosition[]> {
  const [tokens, lp] = await Promise.all([
    fetchWalletTokens(address, prices),
    fetchYuzuLpPositions(address, prices).catch((e) => {
      console.warn(`[movement] Yuzu LP fetch failed for ${address.slice(0, 8)}…:`, (e as Error).message)
      return [] as ZerionPosition[]
    }),
  ])
  return [...tokens, ...lp]
}

/** Fetch Movement balances for multiple wallets (mirrors the other providers). */
export async function fetchMultiMovementBalances(addresses: string[]): Promise<MultiWalletResult> {
  if (addresses.length === 0) return { wallets: [], failedCount: 0 }
  const prices = await fetchYuzuPrices()

  const wallets: ZerionWalletData[] = []
  let failedCount = 0
  const results = await Promise.allSettled(
    addresses.map(async (address) => {
      const positions = await fetchMovementBalances(address, prices)
      return { address, totalValue: positions.reduce((s, p) => s + p.value, 0), positions }
    }),
  )
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === "fulfilled") {
      wallets.push(r.value)
    } else {
      failedCount++
      console.warn(`[movement] Wallet ${addresses[i].slice(0, 8)}… failed: ${r.reason?.message}`)
      if (r.reason?.status === 429) throw r.reason
    }
  }
  if (wallets.length === 0 && addresses.length > 0) {
    throw new Error(`All ${addresses.length} Movement wallet fetches failed`)
  }
  return { wallets, failedCount }
}
