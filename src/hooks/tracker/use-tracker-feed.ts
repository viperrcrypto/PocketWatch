"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query"
import type { TrackerTransaction, TokenHolding, TrackerChain } from "@/lib/tracker/types"
import { trackerFetch, trackerKeys } from "./shared"

// ─── Transaction Feed ───

interface FeedParams {
  chain?: TrackerChain
  type?: string
  walletId?: string
  cursor?: string
  limit?: number
}

export function useTrackerFeed(params: FeedParams = {}) {
  const searchParams = new URLSearchParams()
  if (params.chain) searchParams.set("chain", params.chain)
  if (params.type) searchParams.set("type", params.type)
  if (params.walletId) searchParams.set("walletId", params.walletId)
  if (params.cursor) searchParams.set("cursor", params.cursor)
  if (params.limit) searchParams.set("limit", String(params.limit))

  const qs = searchParams.toString()
  return useQuery({
    queryKey: trackerKeys.feed(params as Record<string, unknown>),
    queryFn: () =>
      trackerFetch<{ transactions: TrackerTransaction[]; nextCursor?: string }>(
        `/feed${qs ? `?${qs}` : ""}`
      ),
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

export function useWalletTransactions(
  walletId: string,
  params: { cursor?: string; limit?: number } = {}
) {
  const searchParams = new URLSearchParams()
  if (params.cursor) searchParams.set("cursor", params.cursor)
  if (params.limit) searchParams.set("limit", String(params.limit))

  const qs = searchParams.toString()
  return useQuery({
    queryKey: trackerKeys.transactions(walletId, params),
    queryFn: () =>
      trackerFetch<{ transactions: TrackerTransaction[]; nextCursor?: string }>(
        `/wallets/${walletId}/transactions${qs ? `?${qs}` : ""}`
      ),
    enabled: !!walletId,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  })
}

export function useWalletHoldings(walletId: string) {
  return useQuery({
    queryKey: trackerKeys.holdings(walletId),
    queryFn: () =>
      trackerFetch<{ holdings: TokenHolding[] }>(`/wallets/${walletId}/holdings`),
    enabled: !!walletId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

// ─── Real-Time Event Stream (Codex SSE) ───

export function useTrackerEventStream(enabled = true) {
  const qc = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const connect = useCallback(() => {
    if (eventSourceRef.current || !enabled) return

    const es = new EventSource("/api/tracker/events-stream")
    eventSourceRef.current = es

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.events?.length > 0) {
          qc.invalidateQueries({ queryKey: trackerKeys.feed({}) })
          qc.invalidateQueries({ queryKey: [...trackerKeys.all, "analytics"] })
          if (data.walletId) {
            qc.invalidateQueries({ queryKey: trackerKeys.holdings(data.walletId) })
            qc.invalidateQueries({ queryKey: trackerKeys.walletPnl(data.walletId) })
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    es.onopen = () => setIsConnected(true)

    es.onerror = () => {
      setIsConnected(false)
      if (es.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null
      }
    }
  }, [enabled, qc])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
      setIsConnected(false)
    }
  }, [])

  useEffect(() => {
    connect()
    return disconnect
  }, [connect, disconnect])

  return { isConnected }
}

// ─── Token Data ───

export function useTrackerToken(chain: string, address: string) {
  return useQuery({
    queryKey: trackerKeys.token(chain, address),
    queryFn: () =>
      trackerFetch<{
        symbol: string
        name: string
        priceUsd: number
        marketCap: number
        totalSupply: number
        holders: number
        logoUrl?: string
      }>(`/token/${chain}/${address}`),
    enabled: !!chain && !!address,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  })
}
