/**
 * Build transaction context for staking flow reconstruction.
 */

import { db } from "@/lib/db"
import {
  getTxChain,
  toAssetKey,
  toSymbolKey,
  walletChainKey,
  toTxKey,
} from "./constants"
import { addToAgg } from "./flow-reconstruction"
import { getProtocolContracts } from "./protocol-contracts"
import { buildSymbolAliases } from "./db-record-conversion"
import type {
  LifecyclePositionInput,
  TxContext,
  TxLeg,
} from "./types"

// ─── Prisma delegate type ───
type PrismaClient = typeof db & Record<string, any>

// ─── Build transaction context ───

export async function buildTxContext(
  userId: string,
  positions: LifecyclePositionInput[],
): Promise<TxContext> {
  const byTx = new Map<string, { wallet: string; chain: string; txHash: string; legs: TxLeg[] }>()
  const byWalletChain = new Map<string, { wallet: string; chain: string; txHash: string; legs: TxLeg[] }[]>()
  const byAsset = new Map<string, { inUsd: number; outUsd: number; latestInTs: number; latestOutTs: number }>()
  const bySymbol = new Map<string, { inUsd: number; outUsd: number; latestInTs: number; latestOutTs: number }>()
  const ownWallets = new Set<string>()

  if (positions.length === 0) return { byTx, byWalletChain, byAsset, bySymbol, ownWallets }

  const prisma = db as PrismaClient

  const wallets = [...new Set(positions.map((p) => p.wallet.toLowerCase()))]
  const chains = [...new Set(positions.map((p) => getTxChain(p.chain)).filter((c): c is string => !!c))]
  const symbols = [...new Set(
    positions.flatMap((p) => buildSymbolAliases(p)).filter(Boolean),
  )]
  const assets = [...new Set(positions.map((p) => p.contractAddress?.toLowerCase()).filter((a): a is string => !!a))]

  // Collect known protocol contract addresses for from/to matching
  const protocolAddrs = new Set<string>()
  for (const p of positions) {
    const txChain = getTxChain(p.chain)
    if (!txChain) continue
    const addrs = getProtocolContracts(p.protocol, txChain)
    for (const addr of addrs) protocolAddrs.add(addr)
  }

  wallets.forEach((wallet) => ownWallets.add(wallet))

  const where: Record<string, unknown> = {
    userId,
    walletAddress: { in: wallets },
  }
  if (chains.length > 0) where.chain = { in: chains }

  const or: Record<string, unknown>[] = []
  if (symbols.length > 0) or.push({ symbol: { in: symbols } })
  if (assets.length > 0) or.push({ asset: { in: assets } })
  // Match txs interacting with known protocol contracts
  const protocolAddrList = [...protocolAddrs]
  if (protocolAddrList.length > 0) {
    or.push({ to: { in: protocolAddrList } })
    or.push({ from: { in: protocolAddrList } })
  }
  if (or.length > 0) where.OR = or

  const candidateRows = await prisma.transactionCache.findMany({
    where,
    select: {
      walletAddress: true,
      chain: true,
      txHash: true,
    },
    orderBy: { blockTimestamp: "asc" },
  })

  const txHashes = [...new Set(
    candidateRows
      .map((row: Record<string, unknown>) => String(row.txHash ?? ""))
      .filter(Boolean),
  )]
  if (txHashes.length === 0) {
    return { byTx, byWalletChain, byAsset, bySymbol, ownWallets }
  }

  // Chunk txHash IN queries to avoid unbounded SQL parameter lists
  const TX_CHUNK_SIZE = 1000
  const rowChunks = await Promise.all(
    Array.from({ length: Math.ceil(txHashes.length / TX_CHUNK_SIZE) }, (_, i) => {
      const batch = txHashes.slice(i * TX_CHUNK_SIZE, (i + 1) * TX_CHUNK_SIZE)
      return prisma.transactionCache.findMany({
        where: {
          userId,
          walletAddress: { in: wallets },
          ...(chains.length > 0 ? { chain: { in: chains } } : {}),
          txHash: { in: batch },
          usdValue: { not: null },
        },
        select: {
          txHash: true,
          walletAddress: true,
          chain: true,
          symbol: true,
          asset: true,
          direction: true,
          usdValue: true,
          value: true,
          blockTimestamp: true,
          from: true,
          to: true,
          category: true,
        },
        orderBy: { blockTimestamp: "asc" },
      })
    })
  )
  const rows = rowChunks.flat()

  const dedupeByTx = new Map<string, Set<string>>()

  for (const row of rows) {
    const txHash = String((row as Record<string, unknown>).txHash || "").toLowerCase()
    const wallet = String((row as Record<string, unknown>).walletAddress || "").toLowerCase()
    const chain = String((row as Record<string, unknown>).chain || "")
    const usd = Number((row as Record<string, unknown>).usdValue ?? 0)
    if (!txHash || !wallet || !chain || !Number.isFinite(usd) || usd <= 0) continue

    const dir = (row as Record<string, unknown>).direction === "out" ? "out" as const : "in" as const
    const ts = Number((row as Record<string, unknown>).blockTimestamp ?? 0)

    const asset = (row as Record<string, unknown>).asset ? String((row as Record<string, unknown>).asset).toLowerCase() : ""
    const symbol = (row as Record<string, unknown>).symbol ? String((row as Record<string, unknown>).symbol).toUpperCase() : ""
    const from = (row as Record<string, unknown>).from ? String((row as Record<string, unknown>).from).toLowerCase() : null
    const to = (row as Record<string, unknown>).to ? String((row as Record<string, unknown>).to).toLowerCase() : null
    const category = (row as Record<string, unknown>).category ? String((row as Record<string, unknown>).category) : null

    const txKey = toTxKey(wallet, chain, txHash)
    const dedupeSig = [
      asset,
      symbol,
      dir,
      from ?? "",
      to ?? "",
      String((row as Record<string, unknown>).usdValue ?? ""),
      category ?? "",
      String((row as Record<string, unknown>).blockTimestamp ?? ""),
    ].join("|")
    const seen = dedupeByTx.get(txKey) ?? new Set<string>()
    if (seen.has(dedupeSig)) continue
    seen.add(dedupeSig)
    dedupeByTx.set(txKey, seen)

    const qty = Number((row as Record<string, unknown>).value ?? 0)

    const entry = byTx.get(txKey) ?? { wallet, chain, txHash, legs: [] }
    entry.legs.push({
      asset: asset || null,
      symbol: symbol || null,
      direction: dir,
      usd,
      quantity: Number.isFinite(qty) ? qty : 0,
      blockTimestamp: ts,
      from,
      to,
      category,
    })
    byTx.set(txKey, entry)

    if (asset) {
      addToAgg(byAsset, toAssetKey(wallet, chain, asset), dir, usd, ts)
    }

    if (symbol) {
      addToAgg(bySymbol, toSymbolKey(wallet, chain, symbol), dir, usd, ts)
    }
  }

  for (const entry of byTx.values()) {
    const key = walletChainKey(entry.wallet, entry.chain)
    const curr = byWalletChain.get(key) ?? []
    curr.push(entry)
    byWalletChain.set(key, curr)
  }

  return { byTx, byWalletChain, byAsset, bySymbol, ownWallets }
}
