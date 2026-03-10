import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { callAIProviderRaw, type AIProviderType } from "@/lib/finance/ai-providers"
import { getKnownAnnualFee } from "@/components/finance/card-image-map"
import { financeRateLimiters, getClientId } from "@/lib/rate-limit"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod/v4"

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

const enrichSchema = z.object({
  cardProfileId: z.string().min(1),
})

export interface CardAIEnrichedData {
  rewardMultipliers: Array<{
    category: string
    rate: number
    unit: string
    description?: string
  }>
  transferPartners: Array<{
    name: string
    ratio: string
    shortCode: string
  }>
  benefits: Array<{
    name: string
    description: string
    icon: string
    value?: number
  }>
  paymentFeatures: Array<{
    label: string
    description: string
  }>
  signupBonus?: {
    description: string
    value: string
  }
  foreignTransactionFee?: string
  annualFee?: number
  cardHighlights?: string[]
  cardImageUrl?: string
}

function buildCardEnrichmentPrompt(
  cardName: string,
  cardNetwork: string,
  rewardType: string,
  rewardProgram: string | null,
  annualFee: number,
  baseRewardRate: number,
): string {
  return `You are a credit card benefits expert. Given the following credit card, provide comprehensive, accurate details about its current benefits and features.

CARD: ${cardName}
NETWORK: ${cardNetwork}
REWARD TYPE: ${rewardType}
REWARD PROGRAM: ${rewardProgram ?? "N/A"}
ANNUAL FEE: $${annualFee}
BASE REWARD RATE: ${baseRewardRate}x

Respond ONLY with valid JSON matching this schema. No markdown, no explanation, just JSON.

SCHEMA:
{
  "rewardMultipliers": [
    { "category": "string (e.g. Dining, Travel, Groceries)", "rate": number, "unit": "string (Points/Cash Back/Miles)", "description": "string (short detail, e.g. 'Including eligible delivery services')" }
  ],
  "transferPartners": [
    { "name": "string (e.g. United MileagePlus)", "ratio": "string (e.g. 1:1)", "shortCode": "string (1-2 char abbreviation)" }
  ],
  "benefits": [
    { "name": "string", "description": "string (1 sentence)", "icon": "string (Material Symbols icon name like 'health_and_safety', 'car_rental', 'verified_user', 'luggage', 'flight', 'restaurant', 'local_atm', 'shield')", "value": number_or_null }
  ],
  "paymentFeatures": [
    { "label": "string", "description": "string" }
  ],
  "signupBonus": { "description": "string", "value": "string (e.g. '60,000 points')" } or null,
  "annualFee": number (current annual fee in USD, e.g. 0, 95, 250, 550, 695),
  "foreignTransactionFee": "string (e.g. 'None' or '3%')",
  "cardHighlights": ["string (1-2 sentence key selling points, max 4)"],
  "cardImageUrl": "string (a direct URL to an official product image of this specific credit card — PNG or JPG, landscape orientation showing the card face. Use a well-known public URL from the issuer's website, a major card comparison site like NerdWallet/The Points Guy/CardPointers, or similar. Must be a direct image URL ending in .png/.jpg/.jpeg/.webp or served as image content. Return null if you cannot find a reliable image URL.)"
}

IMPORTANT:
- Only include reward multipliers that are CURRENTLY active for this specific card
- Transfer partners should only be included if this card's points program actually supports transfers
- Benefits should be real, verified benefits of this specific card
- If you're not sure about a specific detail, omit it rather than guess
- Include 3-8 reward multipliers, 0-15 transfer partners, 3-8 benefits
- Use accurate, up-to-date information
- For cardImageUrl, provide a REAL working URL to an image of this card's face. Prefer official issuer images or well-known finance sites. If unsure, return null.`
}

/**
 * POST: AI-enrich a credit card profile with benefits, multipliers, partners.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("CE01", "Authentication required", 401)

  const body = await request.json()
  const parsed = enrichSchema.safeParse(body)
  if (!parsed.success) {
    return apiError("CE03", parsed.error.issues[0]?.message ?? "Invalid request", 400)
  }

  const { cardProfileId } = parsed.data

  // Verify card belongs to user
  const card = await db.creditCardProfile.findFirst({
    where: { id: cardProfileId, userId: user.id },
  })
  if (!card) {
    return apiError("CE04", "Card not found", 404)
  }

  // Find AI provider — fall back to Claude CLI if no stored key
  const providerKey = await db.externalApiKey.findFirst({
    where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
    orderBy: { updatedAt: "desc" },
  })

  const useCLIFallback = !providerKey

  // Rate limit only for remote API providers
  if (providerKey && providerKey.serviceName !== "ai_claude_cli") {
    const rl = financeRateLimiters.aiCardEnrich(getClientId(request))
    if (!rl.success) {
      return apiError("CE02", "Rate limit exceeded. Try again in a few minutes.", 429)
    }
  }

  try {
    const prompt = buildCardEnrichmentPrompt(
      card.cardName,
      card.cardNetwork,
      card.rewardType,
      card.rewardProgram,
      card.annualFee,
      card.baseRewardRate,
    )

    let rawText: string
    if (useCLIFallback) {
      rawText = await callAIProviderRaw({ provider: "ai_claude_cli", apiKey: "enabled" }, prompt)
    } else {
      const apiKey = await decryptCredential(providerKey.apiKeyEnc)
      const provider = providerKey.serviceName as AIProviderType
      rawText = await callAIProviderRaw({ provider, apiKey }, prompt)
    }

    // Parse JSON from response (handles markdown code blocks)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return apiError("CE06", "AI returned an invalid response. Try again.", 500)
    }

    const enrichedData: CardAIEnrichedData = JSON.parse(jsonMatch[0])

    // Validate structure minimally
    if (!Array.isArray(enrichedData.rewardMultipliers) || !Array.isArray(enrichedData.benefits)) {
      return apiError("CE07", "AI returned malformed data. Try again.", 500)
    }

    // Validate AI-provided card image URL before saving
    let validatedImageUrl: string | undefined
    if (enrichedData.cardImageUrl) {
      try {
        const head = await fetch(enrichedData.cardImageUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(5_000),
        })
        if (head.ok && head.headers.get("content-type")?.startsWith("image/")) {
          validatedImageUrl = enrichedData.cardImageUrl
        }
      } catch { /* skip invalid URL */ }
    }

    // Resolve annual fee: AI enrichment > known cards map > keep existing
    const knownFee = getKnownAnnualFee(card.cardName)
    const resolvedFee = enrichedData.annualFee ?? knownFee

    // Save to database (only save validated image URL)
    const updated = await db.creditCardProfile.update({
      where: { id: cardProfileId },
      data: {
        aiEnrichedData: JSON.parse(JSON.stringify(enrichedData)),
        aiEnrichedAt: new Date(),
        ...(validatedImageUrl ? { cardImageUrl: validatedImageUrl } : {}),
        ...(resolvedFee != null && card.annualFee === 0 ? { annualFee: resolvedFee } : {}),
      },
    })

    return NextResponse.json({
      enrichedData,
      aiEnrichedAt: updated.aiEnrichedAt?.toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "AI enrichment failed"
    return apiError("CE08", message, 500)
  }
}
