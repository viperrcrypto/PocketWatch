import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { callAIProviderRaw, getProviderLabel, type AIProviderType } from "@/lib/finance/ai-providers"
import { buildCancelGuidancePrompt, parseCancelGuidance } from "@/lib/finance/cancel-prompt"
import { getCached, setCache } from "@/lib/cache"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

const bodySchema = z.object({
  merchantName: z.string().min(1).max(200),
  amount: z.number().positive(),
  frequency: z.string().min(1).max(50),
})

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("FCG01", "Authentication required", 401)

  const body = await request.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return apiError("FCG03", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { merchantName, amount, frequency } = parsed.data

  // Check cache first
  const cacheKey = `cancel-guide:${user.id}:${merchantName.toLowerCase().replace(/\s+/g, "-")}`
  const cached = getCached<{ guidance: ReturnType<typeof parseCancelGuidance>; provider: string }>(cacheKey)
  if (cached) {
    return NextResponse.json({ available: true, ...cached })
  }

  // Find active AI provider
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  const useCLIFallback = !providerKey

  // Rate limit only for remote API providers
  if (providerKey && providerKey.serviceName !== "ai_claude_cli") {
    const rl2 = financeRateLimiters.aiGenerate(getClientId(request))
    if (!rl2.success) {
      return apiError("FCG02", "Rate limit exceeded. Try again in a few minutes.", 429)
    }
  }

  try {
    const prompt = buildCancelGuidancePrompt(merchantName, amount, frequency)

    let provider: AIProviderType
    let rawText: string
    if (useCLIFallback) {
      provider = "ai_claude_cli"
      rawText = await callAIProviderRaw({ provider, apiKey: "enabled" }, prompt)
    } else {
      const apiKey = await decryptCredential(providerKey.apiKeyEnc)
      provider = providerKey.serviceName as AIProviderType
      rawText = await callAIProviderRaw({ provider, apiKey }, prompt)
    }
    const guidance = parseCancelGuidance(rawText)

    if (!guidance) {
      return apiError("FCG05", "Failed to parse cancellation guidance", 500)
    }

    const result = { guidance, provider: getProviderLabel(provider) }
    setCache(cacheKey, result, CACHE_TTL)

    return NextResponse.json({ available: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to generate cancellation guide"
    return apiError("FCG06", message, 500)
  }
}
