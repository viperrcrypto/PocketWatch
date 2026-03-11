import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { scanVestingClaims } from "@/lib/portfolio/vesting-claims"

// Allow up to 60s execution on Vercel Pro
export const maxDuration = 60

// ─── In-memory cache ───
// Key: userId, Value: { data, timestamp }
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL_MS = 10 * 60_000 // 10 minutes

// ─── GET: Return cached vesting claims ───

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E8001", "Authentication required", 401)

  const cached = cache.get(user.id)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      ...(cached.data as object),
      meta: { fromCache: true },
    })
  }

  return NextResponse.json({
    claims: [],
    summary: {
      totalClaimable: 0,
      totalLocked: 0,
      platformsChecked: [],
      chainsChecked: [],
      scannedAt: null,
      errors: [],
    },
    meta: { fromCache: false, status: "not_scanned" },
  })
}

// ─── POST: Scan for vesting claims (force refresh) ───

export async function POST(_request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E8002", "Authentication required", 401)

  try {
    const evmAddresses = new Set<string>()
    const solanaAddresses = new Set<string>()

    // Scan the user's tracked wallets
    const trackedWallets = await db.trackedWallet.findMany({
      where: { userId: user.id },
      select: { address: true },
    })

    for (const tw of trackedWallets) {
      const addr = tw.address.toLowerCase()
      if (addr.startsWith("0x")) {
        evmAddresses.add(addr)
      } else if (addr.length >= 32) {
        solanaAddresses.add(tw.address)
      }
    }

    if (evmAddresses.size === 0 && solanaAddresses.size === 0) {
      const emptyResult = {
        claims: [],
        summary: {
          totalClaimable: 0,
          totalLocked: 0,
          platformsChecked: [],
          chainsChecked: [],
          scannedAt: new Date().toISOString(),
          errors: ["No wallet address found on your account. Add a tracked wallet or connect via WalletConnect."],
        },
        meta: { fromCache: false },
      }
      return NextResponse.json(emptyResult)
    }

    // Run the scan
    const result = await scanVestingClaims(
      Array.from(evmAddresses),
      Array.from(solanaAddresses),
    )

    // Cache the result
    cache.set(user.id, { data: result, timestamp: Date.now() })

    return NextResponse.json({
      ...result,
      meta: { fromCache: false },
    })
  } catch (error) {
    return apiError("E8003", "Vesting claims scan failed", 500, error)
  }
}
