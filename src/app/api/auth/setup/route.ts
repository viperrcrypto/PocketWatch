import { NextRequest, NextResponse } from "next/server"
import { apiError } from "@/lib/api-error"
import { hashPassword, createSession, provisionEncryptionSalt, deriveUserDek, isVaultInitialized } from "@/lib/auth"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    // Only allow setup if no user exists
    const initialized = await isVaultInitialized()
    if (initialized) {
      return apiError("E1100", "Vault is already set up.", 400)
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body.password !== "string") {
      return apiError("E1101", "Password is required.", 400)
    }

    const password = body.password

    if (password.length < 8) {
      return apiError("E1103", "Password must be at least 8 characters.", 400)
    }

    const passwordHash = await hashPassword(password)
    const encryptionSalt = provisionEncryptionSalt()
    const user = await db.user.create({
      data: { passwordHash, encryptionSalt },
    })

    const dek = await deriveUserDek(password, user)
    await createSession(user.id, dek)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return apiError("E1109", "Vault setup failed", 500, error)
  }
}
