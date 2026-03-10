/**
 * Codex SDK real-time subscriptions — bar updates, wallet events, balance, token events, prices.
 */

import type { Codex } from "@codex-data/sdk"
import type {
  OnTokenBarsUpdatedSubscriptionVariables,
} from "@codex-data/sdk"
import { getCodex } from "./codex-client"

// ─── Subscribe to real-time bar updates (for SSE relay) ───

export function subscribeTokenBars(
  vars: OnTokenBarsUpdatedSubscriptionVariables,
  callbacks: {
    next: (data: unknown) => void
    error: (err: unknown) => void
    complete: () => void
  },
  codexOverride?: Codex | null
): (() => void) | null {
  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return codex.subscriptions.onTokenBarsUpdated(vars, {
    next(value: { data?: { onTokenBarsUpdated?: unknown } }) {
      callbacks.next(value.data?.onTokenBarsUpdated)
    },
    error(err: unknown) {
      callbacks.error(err)
    },
    complete() {
      callbacks.complete()
    },
  } as any)
}

// ─── Subscribe to wallet events (for SSE relay) ───

export function subscribeWalletEvents(
  makerAddress: string,
  callbacks: {
    next: (data: unknown) => void
    error: (err: unknown) => void
    complete: () => void
  },
  codexOverride?: Codex | null
): (() => void) | null {
  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return codex.subscriptions.onEventsCreatedByMaker(
    { input: { makerAddress } },
    {
      next(value: { data?: { onEventsCreatedByMaker?: unknown } }) {
        callbacks.next(value.data?.onEventsCreatedByMaker)
      },
      error(err: unknown) {
        callbacks.error(err)
      },
      complete() {
        callbacks.complete()
      },
    } as any
  )
}

// ─── Subscribe to balance updates (for SSE relay) ───

export function subscribeBalanceUpdated(
  walletAddress: string,
  callbacks: {
    next: (data: unknown) => void
    error: (err: unknown) => void
    complete: () => void
  },
  codexOverride?: Codex | null
): (() => void) | null {
  const codex = codexOverride ?? getCodex()
  if (!codex) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return codex.subscriptions.onBalanceUpdated(
    { walletAddress },
    {
      next(value: { data?: { onBalanceUpdated?: unknown } }) {
        callbacks.next(value.data?.onBalanceUpdated)
      },
      error(err: unknown) {
        callbacks.error(err)
      },
      complete() {
        callbacks.complete()
      },
    } as any
  )
}

// ─── Subscribe to token trade events (for Token Pulse) ───

export function subscribeTokenEvents(
  tokenAddress: string,
  networkId: number,
  callbacks: {
    next: (data: unknown) => void
    error: (err: unknown) => void
    complete: () => void
  }
): (() => void) | null {
  const codex = getCodex()
  if (!codex) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return codex.subscriptions.onTokenEventsCreated(
    { input: { address: tokenAddress, networkId } as any },
    {
      next(value: { data?: { onTokenEventsCreated?: unknown } }) {
        callbacks.next(value.data?.onTokenEventsCreated)
      },
      error(err: unknown) {
        callbacks.error(err)
      },
      complete() {
        callbacks.complete()
      },
    } as any
  )
}

// ─── Subscribe to price updates (for Token Pulse) ───

export function subscribePriceUpdates(
  inputs: { address: string; networkId: number }[],
  callbacks: {
    next: (data: unknown) => void
    error: (err: unknown) => void
    complete: () => void
  }
): (() => void) | null {
  const codex = getCodex()
  if (!codex) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return codex.subscriptions.onPricesUpdated(
    { input: inputs.map((i) => ({ address: i.address, networkId: i.networkId })) },
    {
      next(value: { data?: { onPricesUpdated?: unknown } }) {
        callbacks.next(value.data?.onPricesUpdated)
      },
      error(err: unknown) {
        callbacks.error(err)
      },
      complete() {
        callbacks.complete()
      },
    } as any
  )
}
