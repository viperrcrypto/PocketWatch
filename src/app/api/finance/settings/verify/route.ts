import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"
import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { toFinanceVerificationPayload, validatePlaidCredentials } from "@/lib/finance/credential-verification"
import { mapFinanceError } from "@/lib/finance/error-map"

const verifySchema = z.object({
  service: z.literal("plaid").default("plaid"),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8030", "Authentication required", 401)

  const body = await req.json().catch(() => ({}))
  const parsed = verifySchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F8031", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const credential = await db.financeCredential.findUnique({
      where: { userId_service: { userId: user.id, service: parsed.data.service } },
    })

    if (!credential) {
      return apiError("F8032", "Plaid credentials not configured", 404)
    }

    const clientId = await decryptCredential(credential.encryptedKey)
    const secret = await decryptCredential(credential.encryptedSecret)

    const verificationResult = await validatePlaidCredentials({
      clientId,
      secret,
      environment: credential.environment,
      probeUserId: user.id,
    })

    const verification = toFinanceVerificationPayload(verificationResult)

    console.info("[finance.settings.verify]", {
      ref: "F8033",
      userId: user.id,
      service: parsed.data.service,
      verifyCode: verification.verifyCode,
      verificationState: verification.verificationState,
    })

    return NextResponse.json({
      service: parsed.data.service,
      ...verification,
    })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to verify credentials")
    return apiError("F8033", mapped.message, mapped.status, err)
  }
}
