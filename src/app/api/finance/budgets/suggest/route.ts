import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { computeBudgetSuggestions } from "@/lib/finance/budget-suggestions"
import { NextResponse } from "next/server"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F9001", "Authentication required", 401)

  try {
    const result = await computeBudgetSuggestions(user.id)
    return NextResponse.json(result)
  } catch (err) {
    return apiError("F9050", "Failed to compute budget suggestions", 500, err)
  }
}
