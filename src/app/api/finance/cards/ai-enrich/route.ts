import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { callAIProviderRaw, type AIProviderType } from "@/lib/finance/ai-providers"
import { getKnownAnnualFee } from "@/components/finance/card-image-map"
import { getKnownCardProfile } from "@/lib/finance/known-card-profiles"
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
  cardNetwork?: string
  rewardType?: string
  rewardProgram?: string | null
  baseRewardRate?: number
  foreignTransactionFee?: string
  annualFee?: number
  productPageUrl?: string
}

/**
 * Fetch a card product page and extract the og:image meta tag for card art.
 * Returns a validated image URL or undefined.
 */
async function fetchCardImageFromProductPage(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8_000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PocketWatch/1.0)" },
    })
    if (!res.ok) return undefined
    const html = await res.text()

    // Extract og:image meta tag
    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)
    if (ogMatch?.[1]) {
      const imgUrl = ogMatch[1].startsWith("http") ? ogMatch[1] : new URL(ogMatch[1], url).href
      // Validate the image actually exists and is an image
      const head = await fetch(imgUrl, { method: "HEAD", signal: AbortSignal.timeout(5_000) })
      if (head.ok && head.headers.get("content-type")?.startsWith("image/")) {
        return imgUrl
      }
    }

    // Fallback: look for card art image in structured data or common patterns
    const structuredMatch = html.match(/"image"\s*:\s*"(https?:\/\/[^"]+(?:card|credit)[^"]*\.(?:png|jpg|jpeg|webp))"/i)
    if (structuredMatch?.[1]) {
      const head = await fetch(structuredMatch[1], { method: "HEAD", signal: AbortSignal.timeout(5_000) })
      if (head.ok && head.headers.get("content-type")?.startsWith("image/")) {
        return structuredMatch[1]
      }
    }

    return undefined
  } catch {
    return undefined
  }
}

function buildCardEnrichmentPrompt(
  cardName: string,
  issuer: string,
): string {
  return `You are a credit card benefits expert. I ALREADY OWN this card. Provide ALL specific benefits, protections, and perks with real details (dollar amounts, time limits, coverage caps, eligibility rules). Do NOT include signup bonuses or marketing language.

CARD NAME: ${cardName}
ISSUER: ${issuer}
COUNTRY: United States

IMPORTANT IDENTIFICATION: Use the card name and issuer to identify EXACTLY which credit card this is. Determine the correct card network (Visa/Mastercard/Amex/Discover), reward type (points/cashback/miles), and reward program from your knowledge. Do NOT rely on any other input — the card name and issuer are the source of truth.

Respond ONLY with valid JSON matching this schema. No markdown, no explanation, just JSON.

SCHEMA:
{
  "rewardMultipliers": [
    { "category": "string (e.g. Dining, Travel, Groceries)", "rate": number, "unit": "string (Points/Cash Back/Miles)", "description": "string (specifics like spending caps, eligible merchants, expiry)" }
  ],
  "transferPartners": [
    { "name": "string (e.g. United MileagePlus)", "ratio": "string (e.g. 1:1)", "shortCode": "string (1-2 char abbreviation)" }
  ],
  "benefits": [
    { "name": "string", "description": "string (SPECIFIC details: coverage amounts, time limits, max claims, what's covered/excluded — e.g. 'Covers up to $10,000 per claim for 120 days from purchase against damage or theft. Max 2 claims per year.')", "icon": "string (Material Symbols icon name like 'health_and_safety', 'car_rental', 'verified_user', 'luggage', 'flight', 'restaurant', 'local_atm', 'shield')", "value": number_or_null, "period": "string ('monthly', 'quarterly', 'annual', or 'one_time')", "perkType": "string ('limited' for credits with dollar value that can be used up, 'unlimited' for protections/access/insurance that are always available)" }
  ],
  "paymentFeatures": [
    { "label": "string", "description": "string (specific details)" }
  ],
  "cardNetwork": "string (the actual card network: 'amex', 'visa', 'mastercard', or 'discover')",
  "rewardType": "string ('points', 'cashback', or 'miles')",
  "rewardProgram": "string (e.g. 'Amex Membership Rewards', 'Chase Ultimate Rewards', 'Capital One Miles') or null",
  "annualFee": number (current annual fee in USD),
  "baseRewardRate": number (base earn rate on non-bonus purchases, e.g. 1 for 1x),
  "foreignTransactionFee": "string (e.g. 'None' or '2.7%')",
  "productPageUrl": "string (the OFFICIAL product page URL on the ISSUER's website for this specific card. Must be the real URL like 'https://www.bankofamerica.com/credit-cards/products/cash-back-credit-card/' or 'https://creditcards.chase.com/cash-back-credit-cards/freedom-unlimited'. NEVER use a made-up URL.)"
}

IMPORTANT:
- List EVERY benefit this card offers, not just 3-8. Include ALL protections, insurance, perks, credits, and features.
- For each benefit include SPECIFIC numbers: coverage amounts, time periods, claim limits, dollar caps.
- Examples of detail level needed: "Extended warranty adds 1 additional year on warranties of 5 years or less, up to $10,000 per claim" NOT just "Extended Warranty — Available"
- Include things like: purchase protection, return protection, extended warranty, car rental insurance, travel insurance, baggage insurance, roadside assistance, cell phone protection, entertainment credits, airline credits, hotel credits, Global Entry/TSA PreCheck, lounge access, concierge — whatever applies to THIS card.
- Do NOT include generic features that exist on all cards: fraud protection, dispute resolution, Amex Offers, Plan It, Plan It®, Pay Over Time, zero liability. These are standard and not real "benefits".
- Only include what this SPECIFIC card actually offers. Omit if unsure.
- NEVER include a benefit with "Not offered" or "Not available" — if the card doesn't have it, simply omit it from the list.
- Do NOT include signup bonus information.
- foreignTransactionFee MUST be accurate: most premium travel cards (Amex Platinum, Amex Gold, Chase Sapphire, Capital One Venture) have NO foreign transaction fee. Only set a fee percentage if you are CERTAIN. When in doubt, return "None".
- rewardMultipliers: use the correct unit for this card. Amex Platinum/Gold earn "Points" (Membership Rewards), NOT "Cash Back". Chase Sapphire earns "Points" (Ultimate Rewards). Only use "Cash Back" for actual cashback cards (Freedom, Discover It, etc.).
- For each benefit: set perkType to "limited" if it has a dollar credit (e.g. "$10/mo Uber credit") or "unlimited" if it's an always-available protection/access (e.g. "Purchase Protection", "Lounge Access"). Set period: "monthly" for monthly credits, "quarterly" for quarterly, "annual" for annual credits, "one_time" for one-time perks. Insurance/protection/access benefits are always "unlimited" with period "annual".
- Use accurate, up-to-date information as of 2025.`
}

/** Merge known + AI benefits, deduplicating by name similarity */
function mergeBenefits(
  known?: CardAIEnrichedData["benefits"],
  ai?: CardAIEnrichedData["benefits"],
): CardAIEnrichedData["benefits"] {
  if (!known?.length) return ai ?? []
  if (!ai?.length) return known
  const result = [...known]
  const knownNames = new Set(known.map((b) => b.name.toLowerCase()))
  for (const aiBenefit of ai) {
    const lower = aiBenefit.name.toLowerCase()
    // Skip if known already has something similar
    const isDupe = [...knownNames].some((kn) =>
      kn.includes(lower) || lower.includes(kn) ||
      (kn.split(" ").length > 1 && lower.split(" ").some((w) => w.length > 4 && kn.includes(w)))
    )
    if (!isDupe) {
      result.push(aiBenefit)
    }
  }
  return result
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

  // Fetch issuer name from linked account
  const acct = await db.financeAccount.findFirst({
    where: { id: card.accountId },
    select: { institution: { select: { institutionName: true } } },
  })
  const issuer = acct?.institution?.institutionName ?? ""

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
    // ── Step 1: Check known card profiles (instant, authoritative) ──
    const knownProfile = getKnownCardProfile(card.cardName, issuer)

    // ── Step 2: Try AI enrichment on top (can add/update, known profile overrides) ──
    let aiData: CardAIEnrichedData | null = null
    try {
      const prompt = buildCardEnrichmentPrompt(card.cardName, issuer)
      let rawText: string
      // Web search so the enriched fee/benefits reflect CURRENT issuer terms, not
      // stale training data. JSON is still recovered via the regex below.
      if (useCLIFallback) {
        rawText = await callAIProviderRaw({ provider: "ai_claude_cli", apiKey: "enabled", model: undefined }, prompt, { webSearch: true })
      } else {
        const apiKey = await decryptCredential(providerKey!.apiKeyEnc)
        const provider = providerKey!.serviceName as AIProviderType
        const webSearch = provider === "ai_claude_api" || provider === "ai_claude_cli"
        rawText = await callAIProviderRaw({ provider, apiKey, model: providerKey!.model ?? undefined }, prompt, { webSearch })
      }
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        if (Array.isArray(parsed.rewardMultipliers) && Array.isArray(parsed.benefits)) {
          aiData = parsed
        }
      }
    } catch {
      // AI failed — that's fine if we have known profile
    }

    // Must have at least one source
    if (!knownProfile && !aiData) {
      return apiError("CE06", "Could not enrich this card. AI returned invalid data and no known profile exists.", 500)
    }

    // ── Step 3: Merge — AI is primary, known profile fills gaps ──
    const enrichedData: CardAIEnrichedData = {
      rewardMultipliers: aiData?.rewardMultipliers ?? knownProfile?.rewardMultipliers ?? [],
      transferPartners: aiData?.transferPartners ?? knownProfile?.transferPartners ?? [],
      benefits: mergeBenefits(aiData?.benefits, knownProfile?.benefits),
      paymentFeatures: aiData?.paymentFeatures ?? knownProfile?.paymentFeatures ?? [],
      cardNetwork: aiData?.cardNetwork ?? knownProfile?.cardNetwork,
      rewardType: aiData?.rewardType ?? knownProfile?.rewardType,
      rewardProgram: aiData?.rewardProgram !== undefined ? aiData.rewardProgram : knownProfile?.rewardProgram,
      baseRewardRate: aiData?.baseRewardRate ?? knownProfile?.baseRewardRate,
      foreignTransactionFee: aiData?.foreignTransactionFee ?? knownProfile?.foreignTransactionFee,
      annualFee: knownProfile?.annualFee ?? getKnownAnnualFee(card.cardName, issuer) ?? aiData?.annualFee,
      productPageUrl: aiData?.productPageUrl,
    }

    // ── Step 4: Resolve card image (known map → web fetch product page → none) ──
    const { getKnownCardImage } = await import("@/components/finance/card-image-map")
    let validatedImageUrl = getKnownCardImage(card.cardName, issuer)

    // If known map doesn't have it, try web-fetching the product page for og:image
    if (!validatedImageUrl && enrichedData.productPageUrl) {
      try {
        const webImage = await fetchCardImageFromProductPage(enrichedData.productPageUrl)
        if (webImage) validatedImageUrl = webImage
      } catch { /* skip — known map or styled card handles it */ }
    }

    // ── Step 5: Save to database ──
    const profileUpdates: Record<string, unknown> = {
      aiEnrichedData: JSON.parse(JSON.stringify(enrichedData)),
      aiEnrichedAt: new Date(),
    }
    // Always overwrite cardImageUrl — clears old garbage (e.g. hallucinated ad images)
    profileUpdates.cardImageUrl = validatedImageUrl ?? null
    if (enrichedData.annualFee != null) profileUpdates.annualFee = enrichedData.annualFee
    if (enrichedData.cardNetwork && ["visa", "mastercard", "amex", "discover"].includes(enrichedData.cardNetwork)) {
      profileUpdates.cardNetwork = enrichedData.cardNetwork
    }
    if (enrichedData.rewardType && ["points", "cashback", "miles"].includes(enrichedData.rewardType)) {
      profileUpdates.rewardType = enrichedData.rewardType
    }
    if (enrichedData.rewardProgram !== undefined) {
      profileUpdates.rewardProgram = enrichedData.rewardProgram
    }
    if (typeof enrichedData.baseRewardRate === "number") {
      profileUpdates.baseRewardRate = enrichedData.baseRewardRate
    }

    const updated = await db.creditCardProfile.update({
      where: { id: cardProfileId },
      data: profileUpdates,
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
