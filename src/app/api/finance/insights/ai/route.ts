import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { computeDeepInsights } from "@/lib/finance/deep-insights-engine"
import { buildAnonymizedFinancialContext } from "@/lib/finance/anonymize"
import { buildFinancialAnalysisPrompt, type AIInsightsResponse } from "@/lib/finance/ai-prompt"
import { callAIProvider, getProviderLabel, type AIProviderType } from "@/lib/finance/ai-providers"
import { getCached, setCache } from "@/lib/cache"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

interface CachedInsights {
  insights: AIInsightsResponse
  provider: string
  providerLabel: string
  generatedAt: string
}

/**
 * GET: Return cached AI insights if available.
 */
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("AII01", "Authentication required", 401)

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const cacheKey = `ai-insights:${user.id}:${month}`

  const cached = getCached<CachedInsights>(cacheKey)
  if (cached) {
    return NextResponse.json({ available: true, ...cached })
  }

  // Check if user has an AI provider configured (Claude CLI always available as fallback)
  const storedProvider = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    select: { serviceName: true },
  })

  return NextResponse.json({
    available: false,
    hasProvider: true, // Claude CLI always available as fallback
    providerLabel: storedProvider
      ? getProviderLabel(storedProvider.serviceName as AIProviderType)
      : getProviderLabel("ai_claude_cli"),
  })
}

/**
 * POST: Generate AI insights (on-demand, user-triggered).
 * Query: ?force=true to bypass cache.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("AII02", "Authentication required", 401)

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const cacheKey = `ai-insights:${user.id}:${month}`
  const force = request.nextUrl.searchParams.get("force") === "true"

  // Check cache first (unless force refresh)
  if (!force) {
    const cached = getCached<CachedInsights>(cacheKey)
    if (cached) {
      return NextResponse.json({ available: true, ...cached })
    }
  }

  // Find active AI provider — fall back to Claude CLI if no stored key
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  const useCLIFallback = !providerKey

  // Rate limit only for remote API providers
  if (providerKey && providerKey.serviceName !== "ai_claude_cli") {
    const rl = financeRateLimiters.aiGenerate(getClientId(request))
    if (!rl.success) {
      return apiError("AII03", "Rate limit exceeded. Try again in a few minutes.", 429)
    }
  }

  try {
    // Get financial data
    const deepInsights = await computeDeepInsights(user.id)
    if (!deepInsights) {
      return apiError("AII05", "No financial data available to analyze.", 400)
    }

    // Load budgets and subscriptions
    const [budgets, subs] = await Promise.all([
      db.financeBudget.findMany({
        where: { userId: user.id, isActive: true },
        select: { category: true, monthlyLimit: true },
      }),
      db.financeSubscription.findMany({
        where: { userId: user.id },
        select: {
          merchantName: true, amount: true, frequency: true,
          category: true, status: true, isWanted: true,
          billType: true,
        },
      }),
    ])

    // Build budget data with spending from deep insights
    const budgetData = budgets.map((b) => {
      const health = deepInsights.budgetHealth.find((h) => h.category === b.category)
      return {
        category: b.category,
        monthlyLimit: b.monthlyLimit,
        spent: health?.spent ?? 0,
        percentUsed: health?.percentUsed ?? 0,
      }
    })

    // Anonymize and build prompt
    const anonymized = buildAnonymizedFinancialContext(deepInsights, budgetData, subs)
    const prompt = buildFinancialAnalysisPrompt(anonymized)

    // Call AI provider (stored key or CLI fallback)
    let provider: AIProviderType
    let insights: AIInsightsResponse
    if (useCLIFallback) {
      provider = "ai_claude_cli"
      insights = await callAIProvider({ provider, apiKey: "enabled" }, prompt)
    } else {
      const apiKey = await decryptCredential(providerKey.apiKeyEnc)
      provider = providerKey.serviceName as AIProviderType
      insights = await callAIProvider({ provider, apiKey }, prompt)
    }

    const result: CachedInsights = {
      insights,
      provider,
      providerLabel: getProviderLabel(provider),
      generatedAt: new Date().toISOString(),
    }

    // Cache for 1 hour
    setCache(cacheKey, result, CACHE_TTL)

    return NextResponse.json({ available: true, ...result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI analysis failed"
    return apiError("AII06", message, 500)
  }
}
