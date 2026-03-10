import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { mapFinanceError } from "@/lib/finance/error-map"
import { createLinkToken } from "@/lib/finance/plaid-client"
import { NextResponse } from "next/server"

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("F1001", "Authentication required", 401)

  try {
    const linkToken = await createLinkToken(user.id)
    console.info("[finance.plaid.link-token.success]", {
      ref: "F1002",
      userId: user.id,
      provider: "plaid",
      verifyCode: "n/a",
    })
    return NextResponse.json({ linkToken })
  } catch (err) {
    console.warn("[finance.plaid.link-token.failed]", {
      ref: "F1002",
      userId: user.id,
      provider: "plaid",
      verifyCode: "n/a",
    })
    const mapped = mapFinanceError(err, "Failed to create link token")
    return apiError("F1002", mapped.message, mapped.status, err)
  }
}
