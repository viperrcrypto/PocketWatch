import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import {
  generateForm8949Csv,
  generateScheduleD,
  generateTurboTaxCsv,
  generateGenericCsv,
  type TaxGainEntry,
  type Form8949Box,
  type ExportFormat,
} from "@/lib/portfolio/tax-export"

/** GET /api/portfolio/analytics/export?format=form8949&taxYear=2025 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("E9240", "Authentication required", 401)

  const sp = request.nextUrl.searchParams
  const format = sp.get("format") as ExportFormat | null
  const taxYear = sp.get("taxYear")
  const walletsParam = sp.getAll("wallets[]")
  const assetsParam = sp.getAll("assets[]")

  if (!format || !["form8949", "schedule_d", "turbotax", "csv"].includes(format)) {
    return apiError("E9241", "Invalid format. Use: form8949, schedule_d, turbotax, csv", 400)
  }
  if (!taxYear || !/^\d{4}$/.test(taxYear)) {
    return apiError("E9242", "taxYear is required (e.g. 2025)", 400)
  }

  try {
    const year = parseInt(taxYear, 10)
    const where: Record<string, unknown> = {
      userId: user.id,
      disposedAt: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    }
    if (walletsParam.length > 0) where.walletAddress = { in: walletsParam }
    if (assetsParam.length > 0) where.asset = { in: assetsParam }

    // Fetch ALL gains for the year (no pagination)
    const gains = await db.realizedGain.findMany({
      where,
      orderBy: { disposedAt: "asc" },
    })

    const entries: TaxGainEntry[] = gains.map((g) => ({
      symbol: g.symbol,
      quantity: g.quantity,
      acquiredAt: g.acquiredAt,
      acquiredAtVarious: g.acquiredAtVarious,
      disposedAt: g.disposedAt,
      proceedsUsd: g.proceedsUsd,
      costBasisUsd: g.costBasisUsd,
      gainUsd: g.gainUsd,
      holdingPeriod: g.holdingPeriod,
      isLongTerm: g.holdingPeriod >= 365,
      costBasisMethod: g.costBasisMethod,
      form8949Box: (g.form8949Box ?? "I") as Form8949Box,
      walletAddress: g.walletAddress,
    }))

    if (format === "schedule_d") {
      const summary = generateScheduleD(entries)
      return NextResponse.json(summary)
    }

    let csv: string
    let filename: string

    switch (format) {
      case "form8949":
        csv = generateForm8949Csv(entries)
        filename = `form-8949-${taxYear}.csv`
        break
      case "turbotax":
        csv = generateTurboTaxCsv(entries)
        filename = `turbotax-${taxYear}.csv`
        break
      case "csv":
      default:
        csv = generateGenericCsv(entries)
        filename = `crypto-gains-${taxYear}.csv`
        break
    }

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return apiError("E9243", "Failed to generate export", 500, error)
  }
}
