import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { scanAirdrops } from "@/lib/portfolio/airdrop-scanner"
import type { AirdropScanResponse } from "@/lib/portfolio/airdrop-types"

// ─── In-memory cache ───
const cache = new Map<string, { data: AirdropScanResponse; timestamp: number }>()
const CACHE_TTL_MS = 10 * 60_000 // 10 minutes

const EMPTY_RESPONSE: AirdropScanResponse = {
  airdrops: [],
  summary: {
    totalUnclaimed: 0,
    totalUnclaimedUsd: 0,
    chainsChecked: [],
    registryVersion: "1.0.0",
    scannedAt: new Date().toISOString(),
  },
  meta: { fromCache: false },
}

// ─── Helpers ───

function isEvmAddress(address: string): boolean {
  return address.startsWith("0x") && address.length === 42
}

function isSolanaAddress(address: string): boolean {
  return !address.startsWith("0x") && address.length >= 32 && address.length <= 44
}

function collectAddresses(
  walletAddress: string | null,
  trackedAddresses: string[],
): { evmAddresses: string[]; solanaAddresses: string[] } {
  const allAddresses = new Set<string>()

  if (walletAddress) allAddresses.add(walletAddress)
  for (const addr of trackedAddresses) allAddresses.add(addr)

  const evmAddresses: string[] = []
  const solanaAddresses: string[] = []

  for (const addr of allAddresses) {
    if (isEvmAddress(addr)) {
      evmAddresses.push(addr)
    } else if (isSolanaAddress(addr)) {
      solanaAddresses.push(addr)
    }
  }

  return { evmAddresses, solanaAddresses }
}

// ─── GET: Return cached airdrops ───

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E8020", "Authentication required", 401)

  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    const withCacheMeta: AirdropScanResponse = {
      ...cached.data,
      meta: { fromCache: true },
    }
    return NextResponse.json(withCacheMeta)
  }

  return NextResponse.json(EMPTY_RESPONSE)
}

// ─── POST: Scan for airdrops ───

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("E8022", "Authentication required", 401)

  try {
    // Gather all wallet addresses
    const trackedWallets = await db.trackedWallet.findMany({
      where: { userId: user.id },
      select: { address: true },
    })

    const trackedAddresses = trackedWallets.map((w) => w.address)
    const { evmAddresses, solanaAddresses } = collectAddresses(
      user.walletAddress,
      trackedAddresses,
    )

    if (evmAddresses.length === 0 && solanaAddresses.length === 0) {
      return NextResponse.json(EMPTY_RESPONSE)
    }

    const result = await scanAirdrops(user.id, evmAddresses, solanaAddresses)

    // Cache the result
    cache.set(user.id, { data: result, timestamp: Date.now() })

    return NextResponse.json(result)
  } catch (err) {
    console.error("[airdrops] Scan failed:", err)
    return apiError("E8023", "Airdrop scan failed", 500, err)
  }
}
