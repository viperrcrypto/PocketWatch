import { getCurrentUser } from "@/lib/auth"
import { apiError } from "@/lib/api-error"
import { db } from "@/lib/db"
import { decryptCredential } from "@/lib/finance/crypto"
import { callAIProviderRaw, type AIProviderType } from "@/lib/finance/ai-providers"
import { getKnownAnnualFee } from "@/components/finance/card-image-map"
import { NextResponse } from "next/server"

/** Rewards program names that Plaid sometimes returns as card names */
const REWARDS_PROGRAM_NAMES = [
  "ultimate rewards", "membership rewards", "thankyou points",
  "thank you points", "cashback rewards", "cash back rewards",
  "venture rewards", "miles rewards",
]

/** Cards with these patterns need identification */
function isUnidentifiedCard(cardName: string): boolean {
  const n = cardName.trim()
  // Generic fallback names
  if (/card\s*••••\d{4}$/i.test(n)) return true
  if (/^credit\s*card$/i.test(n)) return true
  // Rewards program names (not card product names)
  const cleaned = n.replace(/[®™©]/g, "").trim().toLowerCase()
  if (REWARDS_PROGRAM_NAMES.some((rp) => cleaned === rp || cleaned.startsWith(rp))) return true
  // Cardholder names that slipped through
  if (n.length < 25 && /^[A-Z]{1,3}[.\s]/.test(n)) return true
  if (/^[A-Z]+\s[A-Z]+$/.test(n) && !/card|cash|reward|freedom|sapphire|platinum|gold|venture|discover/i.test(n)) return true
  return false
}

const AI_SERVICES = ["ai_claude_cli", "ai_claude_api", "ai_openai", "ai_gemini"]

/**
 * POST: Auto-identify unidentified credit cards using AI + available signals.
 * Gathers APR, credit limit, top merchants, spending patterns per card
 * and asks AI to identify the specific card product.
 */
export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("CI01", "Authentication required", 401)

  try {
    // Find all card profiles
    const cards = await db.creditCardProfile.findMany({
      where: { userId: user.id },
    })

    const unidentified = cards.filter((c) => isUnidentifiedCard(c.cardName))
    if (unidentified.length === 0) {
      return NextResponse.json({ identified: 0, cards: [] })
    }

    // Get account data for each unidentified card
    const accountIds = unidentified.map((c) => c.accountId)
    const accounts = await db.financeAccount.findMany({
      where: { id: { in: accountIds } },
      select: {
        id: true, name: true, officialName: true, mask: true,
        type: true, subtype: true, currentBalance: true, creditLimit: true,
        institution: { select: { institutionName: true } },
      },
    })
    const acctMap = new Map(accounts.map((a) => [a.id, a]))

    // Get liability data (APRs, payment info)
    const liabilities = await db.financeLiabilityCreditCard.findMany({
      where: { userId: user.id, accountId: { in: accountIds } },
    })
    const liabMap = new Map(liabilities.map((l) => [l.accountId, l]))

    // Get top merchants per card (last 6 months of transactions)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    const transactions = await db.financeTransaction.findMany({
      where: {
        userId: user.id,
        accountId: { in: accountIds },
        date: { gte: sixMonthsAgo },
        isExcluded: false,
      },
      select: {
        accountId: true, merchantName: true, name: true,
        amount: true, category: true, plaidCategoryPrimary: true,
      },
      orderBy: { amount: "desc" },
    })

    // Aggregate spending by category per account
    const acctSignals = new Map<string, {
      topMerchants: string[]
      topCategories: Array<{ category: string; total: number }>
      txCount: number
      totalSpend: number
    }>()

    for (const accountId of accountIds) {
      const acctTxs = transactions.filter((t) => t.accountId === accountId && t.amount > 0)
      const merchantCounts = new Map<string, number>()
      const categorySums = new Map<string, number>()
      let totalSpend = 0

      for (const tx of acctTxs) {
        const merchant = tx.merchantName ?? tx.name
        merchantCounts.set(merchant, (merchantCounts.get(merchant) ?? 0) + 1)
        const cat = tx.plaidCategoryPrimary ?? tx.category ?? "Other"
        categorySums.set(cat, (categorySums.get(cat) ?? 0) + tx.amount)
        totalSpend += tx.amount
      }

      const topMerchants = [...merchantCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name]) => name)

      const topCategories = [...categorySums.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([category, total]) => ({ category, total: Math.round(total) }))

      acctSignals.set(accountId, { topMerchants, topCategories, txCount: acctTxs.length, totalSpend: Math.round(totalSpend) })
    }

    // Build AI prompt
    const cardDescriptions = unidentified.map((c) => {
      const acct = acctMap.get(c.accountId)
      const liab = liabMap.get(c.accountId)
      const signals = acctSignals.get(c.accountId)
      const inst = acct?.institution?.institutionName ?? "Unknown"
      const aprs = liab?.aprs as Array<{ aprPercentage: number; aprType: string }> | null

      return [
        `CARD #${c.id.slice(-6)} (last4: ${acct?.mask ?? "unknown"})`,
        `  Institution: ${inst}`,
        `  Network: ${c.cardNetwork}`,
        `  Account type: ${acct?.type ?? "credit"}`,
        `  Plaid account name: "${acct?.name ?? ""}"`,
        `  Plaid official name: "${acct?.officialName ?? ""}"`,
        `  Credit limit: ${acct?.creditLimit ? `$${acct.creditLimit.toLocaleString()}` : "No preset limit"}`,
        `  Current balance: $${Math.abs(acct?.currentBalance ?? 0).toLocaleString()}`,
        aprs && aprs.length > 0 ? `  APRs: ${aprs.map((a) => `${a.aprType} ${a.aprPercentage}%`).join(", ")}` : "  APRs: unknown",
        liab?.minimumPaymentAmount != null ? `  Min payment: $${liab.minimumPaymentAmount}` : "",
        liab?.lastStatementBalance != null ? `  Last statement balance: $${liab.lastStatementBalance}` : "",
        signals ? `  Transaction count (6mo): ${signals.txCount}` : "",
        signals ? `  Total spend (6mo): $${signals.totalSpend.toLocaleString()}` : "",
        signals?.topMerchants.length ? `  Top merchants: ${signals.topMerchants.join(", ")}` : "",
        signals?.topCategories.length ? `  Top spending categories: ${signals.topCategories.map((c) => `${c.category} ($${c.total})`).join(", ")}` : "",
      ].filter(Boolean).join("\n")
    }).join("\n\n")

    const prompt = `You are a credit card identification expert. Given the following credit card accounts with their available data signals, identify the SPECIFIC card product for each.

${cardDescriptions}

For each card, determine the most likely specific product name (e.g., "Chase Freedom Unlimited", "Chase Sapphire Preferred", "Chase Amazon Prime Visa", "American Express Platinum Card", etc.).

Use ALL available signals:
- Institution name tells you the issuer
- Credit limit can indicate premium vs basic cards (no preset limit = charge card like Amex Platinum/Gold)
- APR ranges differ by product
- Spending patterns (travel-heavy = travel card, grocery-heavy = grocery card, etc.)
- Account type "business_credit" = business card
- Plaid account name/official name may contain partial product info

Respond ONLY with valid JSON array. No markdown, no explanation.
[
  { "cardId": "last6chars", "productName": "Full Card Product Name", "annualFee": number_or_null, "confidence": "high|medium|low" }
]

IMPORTANT:
- If you can identify the card with high confidence, use the official product name
- If medium confidence, use your best guess with the issuer prefix
- If you truly cannot determine the product, set productName to null
- Include the issuer name in the product name (e.g., "Chase Freedom Unlimited", not just "Freedom Unlimited")
- For business cards, include "Business" in the name
- Include the current annual fee (e.g., 0 for no fee, 95, 250, 550, 695, etc.)`

    // Find AI provider
    const providerKey = await db.externalApiKey.findFirst({
      where: { userId: user.id, serviceName: { in: AI_SERVICES }, verified: true },
      orderBy: { updatedAt: "desc" },
    })

    let rawText: string
    if (providerKey) {
      const apiKey = await decryptCredential(providerKey.apiKeyEnc)
      rawText = await callAIProviderRaw({ provider: providerKey.serviceName as AIProviderType, apiKey }, prompt)
    } else {
      rawText = await callAIProviderRaw({ provider: "ai_claude_cli", apiKey: "enabled" }, prompt)
    }

    // Parse response
    const jsonMatch = rawText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      return apiError("CI05", "AI returned invalid response", 500)
    }

    const identifications: Array<{ cardId: string; productName: string | null; annualFee?: number | null; confidence: string }> = JSON.parse(jsonMatch[0])

    // Update identified cards in DB
    const updates: Array<{ id: string; oldName: string; newName: string; confidence: string }> = []

    for (const ident of identifications) {
      if (!ident.productName) continue

      const card = unidentified.find((c) => c.id.endsWith(ident.cardId))
      if (!card) continue

      // Resolve annual fee: AI response > known cards map > keep existing
      const acct = acctMap.get(card.accountId)
      const inst = acct?.institution?.institutionName ?? ""
      const knownFee = getKnownAnnualFee(ident.productName, inst)
      const annualFee = ident.annualFee ?? knownFee

      await db.creditCardProfile.update({
        where: { id: card.id },
        data: {
          cardName: ident.productName,
          ...(annualFee != null ? { annualFee } : {}),
        },
      })

      updates.push({
        id: card.id,
        oldName: card.cardName,
        newName: ident.productName,
        confidence: ident.confidence,
      })
    }

    return NextResponse.json({
      identified: updates.length,
      total: unidentified.length,
      cards: updates,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Card identification failed"
    return apiError("CI09", message, 500)
  }
}
