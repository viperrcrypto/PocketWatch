import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { cleanMerchantName, CATEGORIES } from "@/lib/finance/categorize"
import { buildAuditPrompt, type AIAuditResult, type AuditMerchant } from "@/lib/finance/ai-audit-prompt"
import { callAIProviderRaw, getProviderLabel, type AIProviderType } from "@/lib/finance/ai-providers"
import { decryptCredential } from "@/lib/finance/crypto"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

/**
 * POST /api/finance/transactions/ai-audit
 * Reviews existing categorizations using AI and suggests corrections.
 * Only anonymized merchant names are sent to the AI provider.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("AIA01", "Authentication required", 401)

  const providerKey = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  const useCLIFallback = !providerKey

  if (providerKey && providerKey.serviceName !== "ai_claude_cli") {
    const rl = financeRateLimiters.aiGenerate(getClientId(request))
    if (!rl.success) {
      return apiError("AIA02", "Rate limit exceeded. Try again in a few minutes.", 429)
    }
  }

  try {
    // Fetch recent categorized transactions (current month, limit 300)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const categorized = await db.financeTransaction.findMany({
      where: {
        userId: user.id,
        isDuplicate: false,
        isExcluded: false,
        category: { notIn: ["Uncategorized", ""] },
        date: { gte: monthStart },
      },
      select: {
        id: true,
        merchantName: true,
        name: true,
        amount: true,
        category: true,
      },
      take: 300,
      orderBy: { date: "desc" },
    })

    const resolvedProvider = useCLIFallback ? "ai_claude_cli" : providerKey.serviceName

    if (categorized.length === 0) {
      return NextResponse.json({ suggestions: [], provider: resolvedProvider, providerLabel: getProviderLabel(resolvedProvider as AIProviderType) })
    }

    // Group by cleaned merchant name + current category
    const grouped = new Map<string, { ids: string[]; total: number; count: number; category: string; hasCredit: boolean }>()

    for (const tx of categorized) {
      const cleaned = cleanMerchantName(tx.merchantName ?? tx.name)
      const key = `${cleaned}::${tx.category}`
      const existing = grouped.get(key) ?? { ids: [], total: 0, count: 0, category: tx.category ?? "", hasCredit: false }
      existing.ids.push(tx.id)
      existing.total += Math.abs(tx.amount)
      existing.count += 1
      if (tx.amount < 0) existing.hasCredit = true
      grouped.set(key, existing)
    }

    // Build anonymized audit data
    const auditMerchants: AuditMerchant[] = [...grouped.entries()].map(([key, data]) => {
      const name = key.split("::")[0]
      const avg = data.total / data.count
      const amountRange: AuditMerchant["amountRange"] =
        avg < 10 ? "micro" :
        avg < 50 ? "small" :
        avg < 200 ? "medium" : "large"

      return {
        name,
        currentCategory: data.category,
        amountRange,
        frequency: data.count,
        isCredit: data.hasCredit,
      }
    })

    const prompt = buildAuditPrompt(auditMerchants)

    let rawResponse: string
    if (useCLIFallback) {
      rawResponse = await callAIProviderRaw({ provider: "ai_claude_cli", apiKey: "enabled" }, prompt)
    } else {
      const apiKey = await decryptCredential(providerKey.apiKeyEnc)
      rawResponse = await callAIProviderRaw(
        { provider: providerKey.serviceName as AIProviderType, apiKey },
        prompt
      )
    }

    const results = parseAIAuditResponse(rawResponse)
    const validCategories = new Set(Object.keys(CATEGORIES))

    // Map back to transaction IDs
    const suggestions = results
      .filter((r) => validCategories.has(r.suggestedCategory) && r.suggestedCategory !== r.currentCategory)
      .map((r) => {
        // Find matching group
        const groupKey = `${r.merchantName}::${r.currentCategory}`
        const group = grouped.get(groupKey)
        return {
          merchantName: r.merchantName,
          transactionIds: group?.ids ?? [],
          currentCategory: r.currentCategory,
          suggestedCategory: r.suggestedCategory,
          suggestedSubcategory: r.suggestedSubcategory,
          confidence: r.confidence,
          reasoning: r.reasoning,
        }
      })
      .filter((s) => s.transactionIds.length > 0)

    return NextResponse.json({
      suggestions,
      provider: resolvedProvider,
      providerLabel: getProviderLabel(resolvedProvider as AIProviderType),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI audit failed"
    return apiError("AIA04", message, 500)
  }
}

function parseAIAuditResponse(raw: string): AIAuditResult[] {
  const arrayMatch = raw.match(/\[[\s\S]*\]/)
  if (!arrayMatch) return []

  try {
    const parsed = JSON.parse(arrayMatch[0])
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item: unknown): item is AIAuditResult =>
        typeof item === "object" && item !== null &&
        "merchantName" in item && "suggestedCategory" in item && "currentCategory" in item
      )
      .map((item) => ({
        merchantName: String(item.merchantName),
        currentCategory: String(item.currentCategory),
        suggestedCategory: String(item.suggestedCategory),
        suggestedSubcategory: item.suggestedSubcategory ? String(item.suggestedSubcategory) : null,
        confidence: (["high", "medium", "low"].includes(item.confidence) ? item.confidence : "low") as AIAuditResult["confidence"],
        reasoning: String(item.reasoning ?? ""),
      }))
  } catch {
    return []
  }
}
