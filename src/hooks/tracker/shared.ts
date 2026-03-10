import type { TrackerChain } from "@/lib/tracker/types"

// ─── Fetch Helper ───

export async function trackerFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api/tracker${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    signal: options?.signal ?? AbortSignal.timeout(30_000),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(err.error || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ─── Query Key Factory ───

export const trackerKeys = {
  all: ["tracker"] as const,
  wallets: () => [...trackerKeys.all, "wallets"] as const,
  wallet: (id: string) => [...trackerKeys.all, "wallet", id] as const,
  feed: (params: Record<string, unknown>) => [...trackerKeys.all, "feed", params] as const,
  transactions: (walletId: string, params: Record<string, unknown>) =>
    [...trackerKeys.all, "transactions", walletId, params] as const,
  holdings: (walletId: string) => [...trackerKeys.all, "holdings", walletId] as const,
  analytics: (walletId?: string) => [...trackerKeys.all, "analytics", walletId ?? "all"] as const,
  walletPnl: (walletId: string) => [...trackerKeys.all, "pnl", walletId] as const,
  codexStats: (walletId: string) => [...trackerKeys.all, "codex-stats", walletId] as const,
  apiKeys: () => [...trackerKeys.all, "api-keys"] as const,
  telegram: () => [...trackerKeys.all, "telegram"] as const,
  token: (chain: string, address: string) => [...trackerKeys.all, "token", chain, address] as const,
}
