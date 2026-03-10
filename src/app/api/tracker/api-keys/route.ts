import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { apiError } from "@/lib/api-error"
import { API_KEY_SERVICES } from "@/lib/tracker/chains"
import type { TrackerApiKeyData } from "@/lib/tracker/types"

/** GET /api/tracker/api-keys — list configured API key status per service */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("T9001", "Authentication required", 401)

  try {
    const keys = await db.externalApiKey.findMany({
      where: { userId: user.id },
      select: {
        serviceName: true,
        label: true,
        verified: true,
        verifyError: true,
        lastUsedAt: true,
        apiKeyEnc: true,
      },
    })

    const keyMap = new Map(keys.map((k) => [k.serviceName, k]))

    const apiKeys: TrackerApiKeyData[] = API_KEY_SERVICES.map((svc) => {
      const key = keyMap.get(svc.service)
      return {
        service: svc.service,
        label: key?.label ?? svc.label,
        isConfigured: !!key,
        isValid: key?.verified ?? false,
        maskedKey: key?.apiKeyEnc ? `****${key.apiKeyEnc.slice(-4)}` : undefined,
        lastUsedAt: key?.lastUsedAt?.toISOString(),
      }
    })

    return NextResponse.json({ apiKeys })
  } catch (error) {
    return apiError("T9002", "Failed to load API keys", 500, error)
  }
}

/** PUT /api/tracker/api-keys — set/update an API key */
export async function PUT(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T9003", "Authentication required", 401)

  try {
    const { service, apiKey } = await request.json()

    if (!service || !apiKey) {
      return apiError("T9004", "service and apiKey are required", 400)
    }

    const existing = await db.externalApiKey.findFirst({
      where: { userId: user.id, serviceName: service },
    })

    if (existing) {
      await db.externalApiKey.update({
        where: { id: existing.id },
        data: { apiKeyEnc: apiKey, verified: false, verifyError: null },
      })
    } else {
      await db.externalApiKey.create({
        data: {
          userId: user.id,
          serviceName: service,
          apiKeyEnc: apiKey,
          label: service,
          verified: false,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("T9005", "Failed to save API key", 500, error)
  }
}

/** DELETE /api/tracker/api-keys — remove an API key */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("T9006", "Authentication required", 401)

  try {
    const service = request.nextUrl.searchParams.get("service")
    if (!service) {
      return apiError("T9007", "service parameter required", 400)
    }

    await db.externalApiKey.deleteMany({
      where: { userId: user.id, serviceName: service },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return apiError("T9008", "Failed to delete API key", 500, error)
  }
}
