import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { encryptCredential, decryptCredential } from "@/lib/finance/crypto"
import { verifyProvider, type AIProviderType } from "@/lib/finance/ai-providers"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"

const AI_SERVICES = new Set(["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"])

const PROVIDER_META: Record<string, { name: string; requiresKey: boolean }> = {
  ai_claude_cli: { name: "Claude CLI", requiresKey: false },
  ai_claude_api: { name: "Claude API", requiresKey: true },
  ai_openai: { name: "OpenAI", requiresKey: true },
  ai_gemini: { name: "Gemini", requiresKey: true },
}

/**
 * GET: List configured AI providers.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("AI001", "Authentication required", 401)

  const keys = await db.externalApiKey.findMany({
    where: { userId: user.id, serviceName: { in: [...AI_SERVICES] } },
    select: { serviceName: true, verified: true, verifyError: true, updatedAt: true },
  })

  const providers = keys.map((k) => ({
    provider: k.serviceName,
    name: PROVIDER_META[k.serviceName]?.name ?? k.serviceName,
    verified: k.verified,
    verifyError: k.verifyError,
    updatedAt: k.updatedAt.toISOString(),
  }))

  return NextResponse.json({ providers })
}

/**
 * POST: Save a provider config and verify connectivity.
 * Body: { provider: string, apiKey?: string }
 * For Claude CLI, apiKey is optional (we just verify the binary exists).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("AI002", "Authentication required", 401)

  const rl = financeRateLimiters.settingsWrite(getClientId(request))
  if (!rl.success) return apiError("AI003", "Rate limit exceeded", 429)

  const body = await request.json().catch(() => null)
  if (!body?.provider || !AI_SERVICES.has(body.provider)) {
    return apiError("AI004", "Invalid provider", 400)
  }

  const provider = body.provider as AIProviderType
  const meta = PROVIDER_META[provider]

  if (meta?.requiresKey && !body.apiKey?.trim()) {
    return apiError("AI005", "API key required for this provider", 400)
  }

  const apiKeyValue = meta?.requiresKey ? body.apiKey.trim() : "enabled"

  // Verify the provider before saving
  const verification = await verifyProvider({ provider, apiKey: apiKeyValue })

  const encrypted = await encryptCredential(apiKeyValue)

  // Upsert: one active AI provider per type per user
  const existing = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: provider },
  })

  if (existing) {
    await db.externalApiKey.update({
      where: { id: existing.id },
      data: {
        apiKeyEnc: encrypted,
        verified: verification.ok,
        verifyError: verification.error ?? null,
      },
    })
  } else {
    await db.externalApiKey.create({
      data: {
        userId: user.id,
        serviceName: provider,
        apiKeyEnc: encrypted,
        verified: verification.ok,
        verifyError: verification.error ?? null,
      },
    })
  }

  return NextResponse.json({
    provider,
    verified: verification.ok,
    verifyError: verification.error ?? null,
  })
}

/**
 * DELETE: Remove an AI provider.
 * Query: ?provider=ai_claude_cli
 */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("AI006", "Authentication required", 401)

  const provider = request.nextUrl.searchParams.get("provider")
  if (!provider || !AI_SERVICES.has(provider)) {
    return apiError("AI007", "Invalid provider", 400)
  }

  await db.externalApiKey.deleteMany({
    where: { userId: user.id, serviceName: provider },
  })

  return NextResponse.json({ deleted: true })
}
