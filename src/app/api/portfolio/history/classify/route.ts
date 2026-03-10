import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"

export const maxDuration = 30

// All valid classification values (auto + manual-only)
const VALID_CLASSIFICATIONS = new Set([
  "internal_transfer", "swap", "inflow", "outflow", "yield", "gas", "spam",
  // Manual-only classifications for tax purposes
  "income", "gift_received", "gift_sent", "lost", "bridge", "dust",
])

// ─── GET: Fetch transactions with classification details ───

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const params = request.nextUrl.searchParams
  const page = Math.max(1, parseInt(params.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(params.get("limit") ?? "50")))
  const offset = (page - 1) * limit
  const classification = params.get("classification")
  const asset = params.get("asset")
  const chain = params.get("chain")
  const search = params.get("search")
  const unreviewed = params.get("unreviewed") === "true"
  const direction = params.get("direction")

  // Build base conditions
  const baseConditions: Record<string, unknown>[] = [{ userId: user.id }]

  // Classification filter
  if (classification) {
    baseConditions.push({
      OR: [
        { txClassification: classification },
        { manualClassification: classification },
      ],
    })
  }

  // Asset filter (case-insensitive symbol match)
  if (asset) {
    baseConditions.push({ symbol: { contains: asset, mode: "insensitive" } })
  }

  // Chain filter
  if (chain) {
    baseConditions.push({ chain })
  }

  // Direction filter
  if (direction) {
    baseConditions.push({ direction })
  }

  // Unreviewed: only show transactions without a manual override
  if (unreviewed) {
    baseConditions.push({ manualClassification: null })
  }

  // Search: match against txHash, from, to, or symbol
  if (search) {
    baseConditions.push({
      OR: [
        { txHash: { contains: search, mode: "insensitive" } },
        { from: { contains: search, mode: "insensitive" } },
        { to: { contains: search, mode: "insensitive" } },
        { symbol: { contains: search, mode: "insensitive" } },
      ],
    })
  }

  const where = baseConditions.length === 1
    ? baseConditions[0]
    : { AND: baseConditions }

  const [transactions, total] = await Promise.all([
    db.transactionCache.findMany({
      where,
      select: {
        id: true,
        txHash: true,
        chain: true,
        from: true,
        to: true,
        direction: true,
        category: true,
        asset: true,
        symbol: true,
        value: true,
        usdValue: true,
        blockTimestamp: true,
        walletAddress: true,
        txClassification: true,
        manualClassification: true,
        manualClassifiedAt: true,
      },
      orderBy: { blockTimestamp: "desc" },
      skip: offset,
      take: limit,
    }),
    db.transactionCache.count({ where }),
  ])

  // Classification breakdown stats
  const [autoStats, manualStats] = await Promise.all([
    db.transactionCache.groupBy({
      by: ["txClassification"],
      where: { userId: user.id },
      _count: { id: true },
    }),
    db.transactionCache.groupBy({
      by: ["manualClassification"],
      where: { userId: user.id, manualClassification: { not: null } },
      _count: { id: true },
    }),
  ])

  return NextResponse.json({
    transactions,
    total,
    page,
    limit,
    stats: {
      autoClassification: Object.fromEntries(
        autoStats.map((s) => [s.txClassification ?? "unclassified", s._count.id]),
      ),
      manualOverrides: Object.fromEntries(
        manualStats.map((s) => [s.manualClassification!, s._count.id]),
      ),
      totalManualOverrides: manualStats.reduce((sum, s) => sum + s._count.id, 0),
    },
  })
}

// ─── PATCH: Set manual classification for one or more transactions ───

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { ids, classification } = body as { ids: string[]; classification: string | null }

  // Validate classification (null clears the override)
  if (classification !== null && !VALID_CLASSIFICATIONS.has(classification)) {
    return NextResponse.json({ error: "Invalid classification" }, { status: 400 })
  }

  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500) {
    return NextResponse.json({ error: "Provide 1-500 transaction IDs" }, { status: 400 })
  }

  // Verify all IDs belong to this user
  const count = await db.transactionCache.count({
    where: { id: { in: ids }, userId: user.id },
  })
  if (count !== ids.length) {
    return NextResponse.json({ error: "Some transaction IDs not found" }, { status: 404 })
  }

  await db.transactionCache.updateMany({
    where: { id: { in: ids }, userId: user.id },
    data: {
      manualClassification: classification,
      manualClassifiedAt: classification ? new Date() : null,
    },
  })

  return NextResponse.json({ updated: ids.length, classification })
}
