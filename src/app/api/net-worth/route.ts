import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { buildBalancesForUser } from "@/lib/portfolio/balances-read"

/**
 * GET /api/net-worth
 *
 * Returns combined net worth from both finance (fiat) and portfolio (crypto).
 * Aggregates the latest finance account balances + portfolio snapshot value.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("NW001", "Authentication required", 401)

  try {
    // ─── Finance: live account balances ───
    // Must match snapshot logic: exclude hidden accounts, disconnected institutions,
    // and SimpleFIN linked duplicates. Handle all account types.
    const financeAccounts = await db.financeAccount.findMany({
      where: {
        userId: user.id,
        isHidden: false,
        institution: { status: { not: "disconnected" } },
      },
      select: {
        type: true,
        subtype: true,
        currentBalance: true,
        linkedExternalId: true,
        institution: { select: { provider: true } },
      },
    })

    let fiatCash = 0
    let fiatInvestments = 0
    let fiatDebt = 0

    const DEBT_TYPES = new Set(["credit", "business_credit", "loan", "mortgage"])

    for (const acct of financeAccounts) {
      // Skip SimpleFIN linked duplicates (same as snapshot logic)
      if (acct.institution.provider === "simplefin" && acct.linkedExternalId) continue

      const bal = acct.currentBalance ?? 0

      if (acct.type === "depository" || acct.type === "checking" || acct.type === "savings") {
        fiatCash += bal
      } else if (acct.type === "investment" || acct.type === "brokerage") {
        fiatInvestments += bal
      } else if (DEBT_TYPES.has(acct.type)) {
        fiatDebt += Math.abs(bal)
      }
    }

    const fiatNetWorth = fiatCash + fiatInvestments - fiatDebt

    // ─── Portfolio: LIVE cached value (same source as the /portfolio page) ───
    // Previously this read the latest `live_refresh` snapshot, but that snapshot
    // is only written when EVERY wallet returns in one fetch — which never happens
    // with 100+ wallets under provider rate-limiting, so it was frozen at a
    // months-old, near-empty value (~$29k). Read the live multi-provider cache
    // instead (already includes exchange balances), and keep the best snapshot
    // only as a floor so a cold/partial cache can't understate net worth.
    let liveCrypto = 0
    try {
      const live = await buildBalancesForUser(user.id)
      if (!live.error) liveCrypto = live.totalValue
    } catch (err) {
      console.warn("[net-worth] live portfolio read failed, falling back to snapshot:", err)
    }

    // Best available snapshot (+ exchange snapshot) as a fallback/floor.
    const fallbackSnapshot = await db.portfolioSnapshot.findFirst({
      where: { userId: user.id, source: "live_refresh" },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true, metadata: true },
    }) ?? await db.portfolioSnapshot.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { totalValue: true, metadata: true },
    })

    let snapshotCrypto = fallbackSnapshot?.totalValue ?? 0
    const snapshotMeta = fallbackSnapshot?.metadata
      ? (typeof fallbackSnapshot.metadata === "string" ? JSON.parse(fallbackSnapshot.metadata) : fallbackSnapshot.metadata)
      : null
    if ((snapshotMeta?.exchangeTotalValue ?? 0) <= 0) {
      const latestExchangeSnap = await db.exchangeBalanceSnapshot.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { totalValue: true },
      })
      if (latestExchangeSnap) snapshotCrypto += latestExchangeSnap.totalValue
    }

    // Prefer the live value; never show less than the last good snapshot.
    const cryptoValue = Math.max(liveCrypto, snapshotCrypto)

    // ─── Combined ───
    const totalNetWorth = fiatNetWorth + cryptoValue

    // ─── Historical snapshots (last 90 days for sparkline) ───
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const [financeSnapshots, portfolioSnapshots] = await Promise.all([
      db.financeSnapshot.findMany({
        where: { userId: user.id, date: { gte: ninetyDaysAgo } },
        orderBy: { date: "asc" },
        select: { date: true, netWorth: true },
      }),
      db.portfolioSnapshot.findMany({
        where: { userId: user.id, createdAt: { gte: ninetyDaysAgo } },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true, totalValue: true },
      }),
    ])

    // Build a combined daily time series (use null to distinguish "no data" from real zero)
    const dayMap = new Map<string, { fiat: number | null; crypto: number | null }>()

    for (const snap of financeSnapshots) {
      const key = snap.date.toISOString().slice(0, 10)
      const entry = dayMap.get(key) ?? { fiat: null, crypto: null }
      entry.fiat = snap.netWorth
      dayMap.set(key, entry)
    }

    for (const snap of portfolioSnapshots) {
      const key = snap.createdAt.toISOString().slice(0, 10)
      const entry = dayMap.get(key) ?? { fiat: null, crypto: null }
      entry.crypto = snap.totalValue
      dayMap.set(key, entry)
    }

    // Forward-fill gaps so each day has the latest known value
    const sortedDays = [...dayMap.keys()].sort()
    let lastFiat = 0
    let lastCrypto = 0
    const history: Array<{ date: string; fiat: number; crypto: number; total: number }> = []

    for (const day of sortedDays) {
      const entry = dayMap.get(day)!
      if (entry.fiat !== null) lastFiat = entry.fiat
      if (entry.crypto !== null) lastCrypto = entry.crypto
      history.push({
        date: day,
        fiat: lastFiat,
        crypto: lastCrypto,
        total: lastFiat + lastCrypto,
      })
    }

    return NextResponse.json({
      totalNetWorth,
      fiat: {
        cash: fiatCash,
        investments: fiatInvestments,
        debt: fiatDebt,
        netWorth: fiatNetWorth,
      },
      crypto: {
        value: cryptoValue,
        // Live portfolio total (current); null = not a stale snapshot timestamp.
        snapshotAt: null,
      },
      history,
    })
  } catch (error) {
    return apiError("NW002", "Failed to compute net worth", 500, error)
  }
}
