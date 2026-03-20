import { ALCHEMY_CHAIN_SLUGS, CHAIN_CONFIGS } from "@/lib/tracker/chains"
import type { TrackerChain } from "@/lib/tracker/types"

export type ServiceVerifyCode =
  | "ok"
  | "invalid_key"
  | "rate_limited"
  | "network_error"
  | "upstream_error"

export interface ServiceVerifyResult {
  verified: boolean
  code: ServiceVerifyCode
  message: string
  disabledChains?: string[]
}

const VERIFY_TIMEOUT_MS = 12_000
const TEST_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
const ETHERSCAN_API = "https://api.etherscan.io/v2/api"

function ok(message = "Verified"): ServiceVerifyResult {
  return { verified: true, code: "ok", message }
}

function fail(code: Exclude<ServiceVerifyCode, "ok">, message: string): ServiceVerifyResult {
  return { verified: false, code, message }
}

function isRateLimited(status: number, text: string): boolean {
  const lower = text.toLowerCase()
  return status === 429
    || lower.includes("rate limit")
    || lower.includes("too many requests")
}

function isLikelyInvalidKey(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes("invalid api key")
    || lower.includes("missing/invalid api key")
    || lower.includes("must be authenticated")
    || lower.includes("unauthorized")
    || lower.includes("forbidden")
}

function networkFailureMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "AbortError" || err.message.toLowerCase().includes("timeout")) {
      return "Request timed out while verifying key"
    }
    return err.message
  }
  return "Network error while verifying key"
}

function extractAlchemyKey(input: string): string {
  const trimmed = input.trim()
  if (!/^https?:\/\//i.test(trimmed)) return trimmed

  try {
    const url = new URL(trimmed)
    const pathMatch = url.pathname.match(/\/v2\/([^/]+)/i)
    if (pathMatch?.[1]) return pathMatch[1]
    const queryKey = url.searchParams.get("apikey") || url.searchParams.get("api_key")
    if (queryKey) return queryKey
  } catch {
    // Ignore URL parse failures and fall back to original input.
  }

  return trimmed
}

function isAlchemyNetworkDisabledMessage(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes("is not enabled for this app")
    || (lower.includes("enable the network") && lower.includes("alchemy.com/apps"))
}

function isAlchemyQuotaOrCapacityMessage(text: string): boolean {
  const lower = text.toLowerCase()
  return lower.includes("monthly capacity")
    || lower.includes("compute units")
    || lower.includes("throughput")
    || lower.includes("capacity limit")
}

async function verifyZerionKey(apiKey: string): Promise<ServiceVerifyResult> {
  const auth = Buffer.from(`${apiKey}:`).toString("base64")
  const url = `https://api.zerion.io/v1/wallets/${TEST_ADDRESS}/portfolio/?currency=usd`

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    const text = await res.text().catch(() => "")

    if (res.ok) return ok("Zerion key verified")
    if (res.status === 404 && !isLikelyInvalidKey(text)) {
      return ok("Zerion key verified")
    }
    if (res.status === 401 || isLikelyInvalidKey(text)) return fail("invalid_key", "Invalid Zerion API key")
    if (isRateLimited(res.status, text)) return fail("rate_limited", "Zerion rate limit reached while verifying")
    return fail("upstream_error", `Zerion verification failed (${res.status})`)
  } catch (err) {
    return fail("network_error", networkFailureMessage(err))
  }
}

interface EtherscanResponse {
  status?: string
  message?: string
  result?: string | unknown[]
}

/** Generic Etherscan-compatible explorer key verifier (works for BscScan, LineaScan, etc.) */
async function verifyExplorerKey(apiKey: string, apiBaseUrl: string, label: string, chainId?: string): Promise<ServiceVerifyResult> {
  const url = new URL(apiBaseUrl)
  if (chainId) url.searchParams.set("chainid", chainId)
  url.searchParams.set("module", "account")
  url.searchParams.set("action", "txlist")
  url.searchParams.set("address", TEST_ADDRESS)
  url.searchParams.set("startblock", "0")
  url.searchParams.set("endblock", "99999999")
  url.searchParams.set("sort", "desc")
  url.searchParams.set("page", "1")
  url.searchParams.set("offset", "1")
  url.searchParams.set("apikey", apiKey)

  try {
    const res = await fetch(url.toString(), {
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    const text = await res.text().catch(() => "")

    if (!res.ok) {
      if (isRateLimited(res.status, text)) return fail("rate_limited", `${label} rate limit reached while verifying`)
      return fail("upstream_error", `${label} verification failed (${res.status})`)
    }

    let payload: EtherscanResponse = {}
    try {
      payload = JSON.parse(text) as EtherscanResponse
    } catch {
      return fail("upstream_error", `Unexpected ${label} response while verifying`)
    }

    const message = String(payload.message ?? "")
    const resultText = typeof payload.result === "string" ? payload.result : ""
    const combined = `${message} ${resultText}`.trim()
    const lower = combined.toLowerCase()

    if (payload.status === "1") return ok(`${label} key verified`)
    if (payload.status === "0" && message === "No transactions found") return ok(`${label} key verified`)
    if (lower.includes("invalid api key") || lower.includes("missing/invalid api key")) {
      return fail("invalid_key", `Invalid ${label} API key`)
    }
    if (lower.includes("rate limit") || lower.includes("too many requests")) {
      return fail("rate_limited", `${label} rate limit reached while verifying`)
    }
    if (payload.status === "0") {
      return fail("upstream_error", combined || `${label} returned NOTOK`)
    }

    return ok(`${label} key verified`)
  } catch (err) {
    return fail("network_error", networkFailureMessage(err))
  }
}

async function verifyEtherscanKey(apiKey: string): Promise<ServiceVerifyResult> {
  return verifyExplorerKey(apiKey, ETHERSCAN_API, "Etherscan", "1")
}

/** Explorer API URLs for chains that use Etherscan-compatible APIs */
const EXPLORER_APIS: Record<string, { url: string; label: string }> = {
  bscscan: { url: "https://api.bscscan.com/api", label: "BscScan" },
  arbiscan: { url: "https://api.arbiscan.io/api", label: "Arbiscan" },
  basescan: { url: "https://api.basescan.org/api", label: "BaseScan" },
  polygonscan: { url: "https://api.polygonscan.com/api", label: "PolygonScan" },
  optimism_etherscan: { url: "https://api-optimistic.etherscan.io/api", label: "OP Etherscan" },
  lineascan: { url: "https://api.lineascan.build/api", label: "LineaScan" },
  scrollscan: { url: "https://api.scrollscan.com/api", label: "ScrollScan" },
  zksync_explorer: { url: "https://block-explorer-api.mainnet.zksync.io/api", label: "zkSync Explorer" },
}

interface JsonRpcResponse<T = unknown> {
  result?: T
  error?: {
    code?: number
    message?: string
  }
}

const ALCHEMY_CHAIN_TIMEOUT_MS = 6_000

async function testAlchemyChain(
  slug: string,
  apiKey: string,
): Promise<{ slug: string; ok: boolean; invalidKey: boolean; disabled: boolean; error?: string }> {
  const url = `https://${slug}.g.alchemy.com/v2/${apiKey}`
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(ALCHEMY_CHAIN_TIMEOUT_MS),
    })
    const text = await res.text().catch(() => "")

    if (res.status === 401 || isLikelyInvalidKey(text)) {
      return { slug, ok: false, invalidKey: true, disabled: false }
    }
    if (isAlchemyNetworkDisabledMessage(text)) {
      return { slug, ok: false, invalidKey: false, disabled: true }
    }
    if (!res.ok) {
      return { slug, ok: false, invalidKey: false, disabled: false, error: text }
    }

    let payload: JsonRpcResponse<string> = {}
    try { payload = JSON.parse(text) as JsonRpcResponse<string> } catch { /* noop */ }

    if (payload.error) {
      const msg = String(payload.error.message ?? "")
      if (isLikelyInvalidKey(msg)) return { slug, ok: false, invalidKey: true, disabled: false }
      if (isAlchemyNetworkDisabledMessage(msg)) return { slug, ok: false, invalidKey: false, disabled: true }
      return { slug, ok: false, invalidKey: false, disabled: false, error: msg }
    }

    if (typeof payload.result === "string" && payload.result.startsWith("0x")) {
      return { slug, ok: true, invalidKey: false, disabled: false }
    }
    return { slug, ok: false, invalidKey: false, disabled: false, error: "Unexpected result" }
  } catch (err) {
    return { slug, ok: false, invalidKey: false, disabled: false, error: networkFailureMessage(err) }
  }
}

async function verifyAlchemyKey(apiKey: string): Promise<ServiceVerifyResult> {
  const normalizedKey = extractAlchemyKey(apiKey)

  // Step 1: Validate the key itself against ETH Mainnet
  const ethResult = await testAlchemyChain("eth-mainnet", normalizedKey)
  if (ethResult.invalidKey) {
    return fail("invalid_key", "Invalid Alchemy API key")
  }

  // Step 2: Test all chains in parallel
  const chainEntries = Object.entries(ALCHEMY_CHAIN_SLUGS) as [TrackerChain, string][]
  const results = await Promise.allSettled(
    chainEntries.map(([, slug]) => testAlchemyChain(slug, normalizedKey))
  )

  const disabledChains: string[] = []
  let enabledCount = 0

  for (let i = 0; i < results.length; i++) {
    const settled = results[i]
    const [chain] = chainEntries[i]
    const chainName = CHAIN_CONFIGS[chain].name

    if (settled.status === "fulfilled") {
      if (settled.value.disabled) {
        disabledChains.push(chainName)
      } else if (settled.value.ok) {
        enabledCount++
      } else if (settled.value.invalidKey) {
        return fail("invalid_key", "Invalid Alchemy API key")
      } else {
        // Network error or unexpected — treat as enabled (don't penalize flaky responses)
        enabledCount++
      }
    } else {
      // Promise rejected — treat as enabled (don't penalize timeouts)
      enabledCount++
    }
  }

  const totalChains = chainEntries.length

  if (enabledCount === 0 && disabledChains.length === totalChains) {
    return fail("upstream_error", `No chains enabled for this Alchemy app. Enable networks at dashboard.alchemy.com.`)
  }

  if (disabledChains.length > 0) {
    const msg = `Alchemy key verified, but ${disabledChains.length} chain${disabledChains.length > 1 ? "s" : ""} disabled: ${disabledChains.join(", ")}. Enable them at dashboard.alchemy.com for full sync coverage.`
    return { verified: true, code: "ok", message: msg, disabledChains }
  }

  return ok(`Alchemy key verified — all ${totalChains} chains enabled`)
}

async function verifyHeliusKey(apiKey: string): Promise<ServiceVerifyResult> {
  // Use getAssetsByOwner on a known Solana address — lightweight and auth-required
  const testAddress = "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg"
  const url = `https://api.helius.xyz/v0/addresses/${testAddress}/transactions?api-key=${apiKey}&limit=1`

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    const text = await res.text().catch(() => "")

    if (res.ok) return ok("Helius key verified")
    if (res.status === 401 || res.status === 403 || isLikelyInvalidKey(text)) {
      return fail("invalid_key", "Invalid Helius API key")
    }
    if (isRateLimited(res.status, text)) return fail("rate_limited", "Helius rate limit reached while verifying")
    return fail("upstream_error", `Helius verification failed (${res.status})`)
  } catch (err) {
    return fail("network_error", networkFailureMessage(err))
  }
}

async function verifyMoralisKey(apiKey: string): Promise<ServiceVerifyResult> {
  const url = "https://deep-index.moralis.io/api/v2.2/web3/version"

  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-API-Key": apiKey,
      },
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
    const text = await res.text().catch(() => "")

    if (res.ok) return ok("Moralis key verified")
    if (res.status === 401 || res.status === 403 || isLikelyInvalidKey(text)) {
      return fail("invalid_key", "Invalid Moralis API key")
    }
    if (isRateLimited(res.status, text)) return fail("rate_limited", "Moralis rate limit reached while verifying")
    return fail("upstream_error", `Moralis verification failed (${res.status})`)
  } catch (err) {
    return fail("network_error", networkFailureMessage(err))
  }
}

async function verifyCoinGeckoKey(apiKey: string): Promise<ServiceVerifyResult> {
  // Try pro endpoint first, then demo endpoint (free-tier keys use different host + header)
  const endpoints = [
    { url: "https://pro-api.coingecko.com/api/v3/ping", header: "x-cg-pro-api-key" },
    { url: "https://api.coingecko.com/api/v3/ping", header: "x-cg-demo-api-key" },
  ]

  for (const { url, header } of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", [header]: apiKey },
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
      })
      if (res.ok) return ok("CoinGecko key verified")
    } catch { /* try next endpoint */ }
  }

  return fail("invalid_key", "Invalid CoinGecko API key")
}

export async function verifyServiceKey(
  serviceName: string,
  apiKey: string,
): Promise<ServiceVerifyResult> {
  const normalized = serviceName.toLowerCase()
  const trimmed = apiKey.trim()
  if (!trimmed) return fail("invalid_key", "API key is empty")

  if (normalized === "zerion") return verifyZerionKey(trimmed)
  if (normalized === "etherscan") return verifyEtherscanKey(trimmed)
  if (normalized === "alchemy") return verifyAlchemyKey(trimmed)
  if (normalized === "helius") return verifyHeliusKey(trimmed)
  if (normalized === "moralis") return verifyMoralisKey(trimmed)
  if (normalized === "coingecko") return verifyCoinGeckoKey(trimmed)

  // Etherscan-compatible explorers (bscscan, arbiscan, lineascan, etc.)
  const explorer = EXPLORER_APIS[normalized]
  if (explorer) return verifyExplorerKey(trimmed, explorer.url, explorer.label)

  return fail("upstream_error", `Unsupported service: ${serviceName}`)
}
