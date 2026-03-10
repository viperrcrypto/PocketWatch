import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { callAIProviderRaw, getProviderLabel, type AIProviderType } from "@/lib/finance/ai-providers"
import { getCached, setCache } from "@/lib/cache"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { computeBudgetSuggestions, type BudgetSuggestion } from "@/lib/finance/budget-suggestions"
import { NextRequest, NextResponse } from "next/server"

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

// ─── Response Types ─────────────────────────────────────────────

interface BudgetAIAnalysis {
  overallScore: number
  overallVerdict: string
  categoryAnalysis: Array<{
    category: string
    verdict: "under-budgeted" | "over-budgeted" | "well-aligned" | "missing"
    comment: string
    priority: "high" | "medium" | "low"
  }>
  recommendations: Array<{
    action: string
    impact: "high" | "medium" | "low"
  }>
  missingBudgets: Array<{
    category: string
    reason: string
  }>
}

interface CachedBudgetAI {
  analysis: BudgetAIAnalysis
  provider: string
  providerLabel: string
  generatedAt: string
}

// ─── GET: Check cached AI budget analysis ───────────────────────

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("BIA01", "Authentication required", 401)

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const cacheKey = `budget-ai:${user.id}:${month}`

  const cached = getCached<CachedBudgetAI>(cacheKey)
  if (cached) {
    return NextResponse.json({ available: true, ...cached })
  }

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

// ─── POST: Generate AI budget analysis ──────────────────────────

export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("BIA02", "Authentication required", 401)

  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const cacheKey = `budget-ai:${user.id}:${month}`
  const force = request.nextUrl.searchParams.get("force") === "true"

  if (!force) {
    const cached = getCached<CachedBudgetAI>(cacheKey)
    if (cached) {
      return NextResponse.json({ available: true, ...cached })
    }
  }

  // Find AI provider — fall back to Claude CLI if no stored key
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  const useCLIFallback = !providerKey

  // Rate limit only for remote API providers
  if (providerKey && providerKey.serviceName !== "ai_claude_cli") {
    const rl = financeRateLimiters.aiGenerate(getClientId(request))
    if (!rl.success) {
      return apiError("BIA03", "Rate limit exceeded. Try again in a few minutes.", 429)
    }
  }

  try {
    // Get spending suggestions from shared module
    const { suggestions } = await computeBudgetSuggestions(user.id)

    // Get current budgets with spending
    const budgets = await db.financeBudget.findMany({
      where: { userId: user.id, isActive: true },
      select: { category: true, monthlyLimit: true },
    })

    // Get current month spending by category
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const txs = await db.financeTransaction.findMany({
      where: {
        userId: user.id,
        isDuplicate: false,
        isExcluded: false,
        amount: { gt: 0 },
        date: { gte: startOfMonth, lt: endOfMonth },
      },
      select: { category: true, amount: true },
    })

    const spentByCategory = new Map<string, number>()
    for (const tx of txs) {
      const cat = tx.category ?? "Uncategorized"
      spentByCategory.set(cat, (spentByCategory.get(cat) ?? 0) + tx.amount)
    }

    const budgetMap = new Map(budgets.map((b) => [b.category, b.monthlyLimit]))

    // Build prompt
    const prompt = buildBudgetAnalysisPrompt(suggestions, budgetMap, spentByCategory)

    // Call AI provider (stored key or CLI fallback)
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
    const analysis = parseBudgetAIResponse(rawText)

    const result: CachedBudgetAI = {
      analysis,
      provider,
      providerLabel: getProviderLabel(provider),
      generatedAt: new Date().toISOString(),
    }

    setCache(cacheKey, result, CACHE_TTL)

    return NextResponse.json({ available: true, ...result })
  } catch (err: unknown) {
    console.error("[budget-ai] analysis failed", err)
    return apiError("BIA06", "AI budget analysis failed. Please try again.", 500)
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function buildBudgetAnalysisPrompt(
  suggestions: BudgetSuggestion[],
  budgetMap: Map<string, number>,
  spentByCategory: Map<string, number>,
): string {
  const hasBudgets = budgetMap.size > 0
  const monthName = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const suggestionsSection = suggestions.map((s) => {
    const budget = budgetMap.get(s.category)
    const spent = spentByCategory.get(s.category) ?? 0
    const budgetStr = budget != null
      ? `budget: $${budget} (${Math.round((s.suggested / budget) * 100)}% of budget)`
      : "no budget set"
    return `- ${s.category}: avg $${s.avgMonthly}/mo, suggested $${s.suggested}, ${budgetStr}, spent $${Math.round(spent)} this month (${s.monthsOfData}mo data)`
  }).join("\n")

  const budgetOnlyCategories = Array.from(budgetMap.entries())
    .filter(([cat]) => !suggestions.find((s) => s.category === cat))
    .map(([cat, limit]) => {
      const spent = spentByCategory.get(cat) ?? 0
      return `- ${cat}: budget $${limit}, spent $${Math.round(spent)} this month (no historical spending data)`
    }).join("\n")

  return `You are a personal finance budget optimizer analyzing data for ${monthName}.
Respond ONLY with valid JSON matching the schema below. No markdown, no explanation, just JSON.

SCHEMA:
{
  "overallScore": number (0-100, how well-optimized the user's budgets are vs their actual spending),
  "overallVerdict": "string (1-2 sentences summarizing budget health)",
  "categoryAnalysis": [{ "category": "string", "verdict": "under-budgeted|over-budgeted|well-aligned|missing", "comment": "string (specific advice)", "priority": "high|medium|low" }],
  "recommendations": [{ "action": "string (specific actionable step)", "impact": "high|medium|low" }],
  "missingBudgets": [{ "category": "string", "reason": "string" }]
}

DATA-DRIVEN BUDGET SUGGESTIONS (based on spending history):
${suggestionsSection}
${budgetOnlyCategories ? `\nBUDGET-ONLY CATEGORIES (budget set but minimal spending data):\n${budgetOnlyCategories}` : ""}
${!hasBudgets ? "\nNOTE: User has NO budgets set yet. Score should reflect this. Recommend they adopt the data-driven suggestions as a starting point." : ""}

RULES:
- "under-budgeted" = budget is too low vs actual spending (will overspend)
- "over-budgeted" = budget is much higher than spending (money could be allocated elsewhere)
- "well-aligned" = budget is within 15% of data-driven suggestion
- "missing" = spending exists but no budget set
- Categories with spending but no budget should appear in missingBudgets
- Be specific: reference actual dollar amounts
- Keep comments under 100 characters
- overallScore: 90+ if all categories well-aligned, 70-89 if some misalignment, 50-69 if significant gaps, <50 if no budgets or very poor fit
- Limit recommendations to 5 max, prioritize highest impact`
}

const VALID_VERDICTS = new Set(["under-budgeted", "over-budgeted", "well-aligned", "missing"])
const VALID_PRIORITY = new Set(["high", "medium", "low"])

function parseBudgetAIResponse(rawText: string): BudgetAIAnalysis {
  const jsonMatch = rawText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0])

      const categoryAnalysis = (Array.isArray(parsed.categoryAnalysis) ? parsed.categoryAnalysis : [])
        .filter((c: Record<string, unknown>) =>
          typeof c.category === "string" &&
          VALID_VERDICTS.has(c.verdict as string) &&
          VALID_PRIORITY.has(c.priority as string)
        )
        .map((c: Record<string, unknown>) => ({
          category: String(c.category).slice(0, 100),
          verdict: c.verdict as BudgetAIAnalysis["categoryAnalysis"][number]["verdict"],
          comment: String(c.comment ?? "").slice(0, 200),
          priority: c.priority as "high" | "medium" | "low",
        }))

      const recommendations = (Array.isArray(parsed.recommendations) ? parsed.recommendations : [])
        .filter((r: Record<string, unknown>) =>
          typeof r.action === "string" && VALID_PRIORITY.has(r.impact as string)
        )
        .map((r: Record<string, unknown>) => ({
          action: String(r.action).slice(0, 200),
          impact: r.impact as "high" | "medium" | "low",
        }))

      const missingBudgets = (Array.isArray(parsed.missingBudgets) ? parsed.missingBudgets : [])
        .filter((m: Record<string, unknown>) => typeof m.category === "string")
        .map((m: Record<string, unknown>) => ({
          category: String(m.category).slice(0, 100),
          reason: String(m.reason ?? "").slice(0, 200),
        }))

      return {
        overallScore: typeof parsed.overallScore === "number"
          ? Math.max(0, Math.min(100, Math.round(parsed.overallScore)))
          : 50,
        overallVerdict: String(parsed.overallVerdict ?? "Analysis complete.").slice(0, 500),
        categoryAnalysis,
        recommendations,
        missingBudgets,
      }
    } catch {
      // Fall through
    }
  }

  return {
    overallScore: 50,
    overallVerdict: rawText.slice(0, 200),
    categoryAnalysis: [],
    recommendations: [],
    missingBudgets: [],
  }
}
