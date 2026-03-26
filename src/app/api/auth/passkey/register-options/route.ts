import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { getCurrentUser } from "@/lib/auth"
import { createRegistrationOptions, getRpConfig } from "@/lib/passkey"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("E1200", "Authentication required", 401)

    const existing = await db.passkey.findMany({
      where: { userId: user.id },
      select: { credentialId: true },
    })

    const rp = getRpConfig(request)
    const options = await createRegistrationOptions(
      user.id,
      "PocketWatch Vault",
      existing.map((p) => p.credentialId),
      rp,
    )

    return NextResponse.json(options)
  } catch (error) {
    return apiError("E1209", "Failed to generate registration options", 500, error)
  }
}
