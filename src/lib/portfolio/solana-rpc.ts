/**
 * Solana RPC helpers for token account discovery and signature fetching.
 */

const SOLANA_RPC = "https://api.mainnet-beta.solana.com"
const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"

/** Discover all SPL token accounts (ATAs) owned by this wallet via Solana RPC.
 *  Queries both the original Token Program and Token-2022. */
export async function discoverTokenAccounts(walletAddress: string): Promise<string[]> {
  const programIds = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]
  const results: string[] = []

  for (const programId of programIds) {
    try {
      const res = await fetch(SOLANA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTokenAccountsByOwner",
          params: [
            walletAddress,
            { programId },
            { encoding: "jsonParsed" },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      })
      const data = await res.json() as {
        result?: { value?: { pubkey: string }[] }
      }
      for (const v of data.result?.value ?? []) {
        results.push(v.pubkey)
      }
    } catch {
      // Non-critical: one program query failing shouldn't block the other
      console.warn(`[solana-fetcher] getTokenAccountsByOwner failed for program ${programId.slice(0, 12)}`)
    }
  }

  return results
}

/** Get recent signatures for an address via Solana RPC. */
export async function getSignaturesForAddress(
  address: string,
  options: { limit?: number; before?: string },
): Promise<{ signature: string; blockTime: number | null }[]> {
  const params: Record<string, unknown> = { limit: options.limit ?? 100 }
  if (options.before) params.before = options.before

  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [address, params],
    }),
    signal: AbortSignal.timeout(15_000),
  })
  const data = await res.json() as {
    result?: { signature: string; blockTime: number | null; err: unknown }[]
  }
  // Only return successful transactions
  return (data.result ?? []).filter((s) => s.err === null)
}

/** Resolve SPL token metadata (symbol + decimals) from a mint address via Solana RPC. */
export async function resolveSPLToken(mint: string): Promise<{ symbol: string; decimals: number }> {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [mint, { encoding: "jsonParsed" }],
    }),
    signal: AbortSignal.timeout(10_000),
  })
  const data = await res.json() as {
    result?: { value?: { data?: { parsed?: { info?: { symbol?: string; decimals?: number } } } } }
  }
  const info = data.result?.value?.data?.parsed?.info
  return {
    symbol: info?.symbol ?? mint.slice(0, 6),
    decimals: info?.decimals ?? 9,
  }
}
