import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { getCurrentUser, getSession } from "@/lib/auth"
import { verifyRegistration, getRpConfig } from "@/lib/passkey"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("E1210", "Authentication required", 401)

    const body = await request.json().catch(() => null)
    if (!body) return apiError("E1211", "Invalid request body", 400)

    const rp = getRpConfig(request)
    const verification = await verifyRegistration(user.id, body, rp)

    if (!verification.verified || !verification.registrationInfo) {
      return apiError("E1212", "Passkey registration failed verification", 400)
    }

    const { credential } = verification.registrationInfo

    // Copy the session's master-key-wrapped DEK so passkey auth can replay it
    // into new sessions. If ENCRYPTION_KEY rotates, passkey-stored DEKs become
    // stale — the user must re-register passkeys after a key rotation.
    const session = await getSession()
    const wrappedDek = session?.encryptedDek ?? null

    const name = typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : "Passkey"

    await db.passkey.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: body.response?.transports ?? [],
        wrappedDek,
        name,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Registration failed"
    if (message === "Challenge expired or not found") {
      return apiError("E1213", "Challenge expired. Please try again.", 400)
    }
    return apiError("E1219", "Passkey registration failed", 500, error)
  }
}
