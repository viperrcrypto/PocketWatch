import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { getHiddenTokenSymbols, setHiddenTokens } from "@/lib/portfolio/hidden-tokens"
import { invalidateBalancesResponseCache } from "@/app/api/portfolio/balances/route"
import { invalidateBlockchainBalancesCache } from "@/app/api/portfolio/balances/blockchain/route"

/** GET /api/portfolio/balances/hidden-tokens */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("E9060", "Authentication required", 401)

  try {
    const hidden = await getHiddenTokenSymbols(user.id)
    return NextResponse.json({ hiddenTokens: Array.from(hidden) })
  } catch (error) {
    return apiError("E9061", "Failed to load hidden tokens", 500, error)
  }
}

/** POST /api/portfolio/balances/hidden-tokens — add a symbol */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9062", "Authentication required", 401)

  try {
    const { symbol } = await request.json()
    if (!symbol || typeof symbol !== "string") {
      return apiError("E9063", "Missing or invalid symbol", 400)
    }

    const existing = await getHiddenTokenSymbols(user.id)
    existing.add(symbol)
    await setHiddenTokens(user.id, Array.from(existing))
    invalidateBalancesResponseCache(user.id)
    invalidateBlockchainBalancesCache(user.id)
    return NextResponse.json({ hiddenTokens: Array.from(existing) })
  } catch (error) {
    return apiError("E9064", "Failed to hide token", 500, error)
  }
}

/** DELETE /api/portfolio/balances/hidden-tokens — remove a symbol */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9065", "Authentication required", 401)

  try {
    const { symbol } = await request.json()
    if (!symbol || typeof symbol !== "string") {
      return apiError("E9066", "Missing or invalid symbol", 400)
    }

    const existing = await getHiddenTokenSymbols(user.id)
    existing.delete(symbol)
    await setHiddenTokens(user.id, Array.from(existing))
    invalidateBalancesResponseCache(user.id)
    invalidateBlockchainBalancesCache(user.id)
    return NextResponse.json({ hiddenTokens: Array.from(existing) })
  } catch (error) {
    return apiError("E9067", "Failed to unhide token", 500, error)
  }
}
