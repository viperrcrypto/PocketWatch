import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { getVaultOwner, createSessionWithWrappedDek } from "@/lib/auth"
import { verifyAuthentication, getRpConfig } from "@/lib/passkey"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const user = await getVaultOwner()
    if (!user) return apiError("E1230", "No vault configured", 400)

    const body = await request.json().catch(() => null)
    if (!body) return apiError("E1231", "Invalid request body", 400)

    // Find the passkey by credential ID from the response
    if (typeof body.id !== "string" || !body.id) {
      return apiError("E1232", "Missing credential ID", 400)
    }
    const credentialIdB64 = body.id

    const passkey = await db.passkey.findUnique({
      where: { credentialId: credentialIdB64 },
    })

    if (!passkey || passkey.userId !== user.id) {
      return apiError("E1233", "Unknown passkey", 400)
    }

    const rp = getRpConfig(request)
    const verification = await verifyAuthentication(
      user.id,
      body,
      passkey.credentialId,
      new Uint8Array(passkey.publicKey),
      passkey.counter,
      rp,
    )

    if (!verification.verified) {
      return apiError("E1234", "Passkey authentication failed", 401)
    }

    // Create session first — if this fails, the counter stays unchanged so the
    // user can retry. Counter update failing is recoverable; a stale session is not.
    await createSessionWithWrappedDek(user.id, passkey.wrappedDek)

    await db.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed"
    if (message === "Challenge expired or not found") {
      return apiError("E1235", "Challenge expired. Please try again.", 400)
    }
    return apiError("E1239", "Passkey authentication failed", 500, error)
  }
}
