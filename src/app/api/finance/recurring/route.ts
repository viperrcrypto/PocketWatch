import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("FR010", "Authentication required", 401)

  try {
    const streams = await db.financeRecurringStream.findMany({
      where: { userId: user.id },
      orderBy: { lastDate: "desc" },
    })

    const inflows = streams.filter((s) => s.streamType === "inflow")
    const outflows = streams.filter((s) => s.streamType === "outflow")

    const totalMonthlyInflow = inflows
      .filter((s) => s.isActive)
      .reduce((sum, s) => sum + Math.abs(s.averageAmount ?? 0), 0)
    const totalMonthlyOutflow = outflows
      .filter((s) => s.isActive)
      .reduce((sum, s) => sum + Math.abs(s.averageAmount ?? 0), 0)

    return NextResponse.json({ inflows, outflows, totalMonthlyInflow, totalMonthlyOutflow })
  } catch (err) {
    return apiError("FR011", "Failed to fetch recurring streams", 500, err)
  }
}
