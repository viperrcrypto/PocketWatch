import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { encryptCredential, decryptCredential } from "@/lib/finance/crypto"
import { toFinanceVerificationPayload, validatePlaidCredentials } from "@/lib/finance/credential-verification"
import { mapFinanceError } from "@/lib/finance/error-map"
import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod/v4"

function maskKey(key: string): string {
  if (key.length <= 8) return "****"
  return `${key.slice(0, 4)}****${key.slice(-4)}`
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("F8001", "Authentication required", 401)

  try {
    const credentials = await db.financeCredential.findMany({
      where: { userId: user.id },
    })

    const services = await Promise.all(
      credentials.map(async (cred) => {
        const clientId = await decryptCredential(cred.encryptedKey)
        return {
          service: cred.service,
          maskedKey: maskKey(clientId),
          environment: cred.environment,
          updatedAt: cred.updatedAt,
          verified: false,
          verificationState: "unknown" as const,
          verifyCode: "unknown" as const,
          verifyError: null as string | null,
        }
      })
    )

    return NextResponse.json({ services })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to fetch settings")
    return apiError("F8002", mapped.message, mapped.status, err)
  }
}

const saveSchema = z.object({
  service: z.literal("plaid"),
  clientId: z.string().min(1, "Client ID is required"),
  secret: z.string().min(1, "Secret is required"),
  environment: z.enum(["sandbox", "development", "production"]).default("development"),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8010", "Authentication required", 401)

  const body = await req.json()
  const parsed = saveSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("F8011", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  try {
    const verificationResult = await validatePlaidCredentials({
      clientId: parsed.data.clientId,
      secret: parsed.data.secret,
      environment: parsed.data.environment,
      probeUserId: user.id,
    })
    const verification = toFinanceVerificationPayload(verificationResult)

    // Reject if verification definitively failed
    if (verification.verificationState === "failed") {
      return apiError(
        "F8013",
        verification.verifyError ?? "Credential verification failed. Please check your Client ID and Secret.",
        400
      )
    }

    // Reject transient/unknown states — user should retry later
    if (verification.verificationState === "unknown") {
      return apiError(
        "F8014",
        "Could not verify credentials at this time. Please try again in a moment.",
        503
      )
    }

    const encryptedKey = await encryptCredential(parsed.data.clientId)
    const encryptedSecret = await encryptCredential(parsed.data.secret)

    await db.financeCredential.upsert({
      where: {
        userId_service: { userId: user.id, service: parsed.data.service },
      },
      create: {
        userId: user.id,
        service: parsed.data.service,
        encryptedKey,
        encryptedSecret,
        environment: parsed.data.environment,
      },
      update: {
        encryptedKey,
        encryptedSecret,
        environment: parsed.data.environment,
      },
    })

    console.info("[finance.settings.save]", {
      ref: "F8012",
      userId: user.id,
      service: parsed.data.service,
      verifyCode: verification.verifyCode,
      verificationState: verification.verificationState,
    })

    return NextResponse.json({
      saved: true,
      service: parsed.data.service,
      ...verification,
    })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to save credentials")
    return apiError("F8012", mapped.message, mapped.status, err)
  }
}

const deleteSchema = z.object({
  service: z.literal("plaid"),
})

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("F8020", "Authentication required", 401)

  const { searchParams } = new URL(req.url)
  const service = searchParams.get("service")
  const parsed = deleteSchema.safeParse({ service })
  if (!parsed.success) {
    return apiError("F8021", "Invalid service", 400)
  }

  try {
    await db.financeCredential.deleteMany({
      where: { userId: user.id, service: parsed.data.service },
    })

    console.info("[finance.settings.delete]", {
      ref: "F8022",
      userId: user.id,
      service: parsed.data.service,
    })

    return NextResponse.json({ deleted: true })
  } catch (err) {
    const mapped = mapFinanceError(err, "Failed to delete credentials")
    return apiError("F8022", mapped.message, mapped.status, err)
  }
}
