import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { fetchFullPlaidHistory } from "@/lib/finance/sync"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("F9010", "Authentication required", 401)

  try {
    const result = await fetchFullPlaidHistory(user.id)
    return NextResponse.json(result)
  } catch (err) {
    return apiError("F9011", "Failed to fetch transaction history", 500, err)
  }
}
