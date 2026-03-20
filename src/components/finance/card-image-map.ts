/**
 * Hardcoded card art images and annual fees for popular credit cards.
 * Images are self-hosted in /public/card-art/ to prevent CDN URL breakage.
 * Used as a reliable fallback when AI enrichment doesn't provide a valid image.
 */

interface KnownCard {
  readonly keywords: readonly string[]
  readonly imageUrl: string
  readonly annualFee?: number
}

const KNOWN_CARDS: readonly KnownCard[] = [
  // Chase
  {
    keywords: ["sapphire", "reserve"],
    imageUrl: "/card-art/sapphire-reserve.png",
    annualFee: 795,
  },
  {
    keywords: ["sapphire", "preferred"],
    imageUrl: "/card-art/sapphire-preferred.png",
    annualFee: 95,
  },
  {
    keywords: ["freedom", "unlimited"],
    imageUrl: "/card-art/freedom-unlimited.png",
    annualFee: 0,
  },
  {
    keywords: ["freedom", "flex"],
    imageUrl: "/card-art/freedom-flex.png",
    annualFee: 0,
  },
  {
    keywords: ["ultimate", "rewards"],
    imageUrl: "/card-art/sapphire-reserve.png",
    annualFee: 795,
  },
  {
    keywords: ["prime", "visa"],
    imageUrl: "/card-art/amazon-prime-visa.png",
    annualFee: 0,
  },
  {
    keywords: ["amazon", "business"],
    imageUrl: "/card-art/amex-amazon-business.png",
    annualFee: 0,
  },
  {
    keywords: ["hyatt"],
    imageUrl: "/card-art/hyatt.png",
    annualFee: 95,
  },
  {
    keywords: ["united", "quest"],
    imageUrl: "/card-art/united-quest.png",
    annualFee: 250,
  },
  {
    keywords: ["united", "explorer"],
    imageUrl: "/card-art/united-explorer.png",
    annualFee: 95,
  },
  {
    keywords: ["united", "business"],
    imageUrl: "/card-art/united-explorer.png",
    annualFee: 99,
  },
  {
    keywords: ["ink", "preferred"],
    imageUrl: "/card-art/ink-preferred.png",
    annualFee: 95,
  },
  {
    keywords: ["ink", "unlimited"],
    imageUrl: "/card-art/ink-unlimited.png",
    annualFee: 0,
  },
  {
    keywords: ["ink", "cash"],
    imageUrl: "/card-art/ink-cash.png",
    annualFee: 0,
  },
  // Amex
  {
    keywords: ["american express", "platinum"],
    imageUrl: "/card-art/amex-platinum.png",
    annualFee: 895,
  },
  {
    keywords: ["amex", "platinum"],
    imageUrl: "/card-art/amex-platinum.png",
    annualFee: 895,
  },
  {
    keywords: ["american express", "gold"],
    imageUrl: "/card-art/amex-gold.png",
    annualFee: 325,
  },
  {
    keywords: ["blue", "business", "plus"],
    imageUrl: "/card-art/amex-blue-business-plus.png",
    annualFee: 0,
  },
  {
    keywords: ["blue cash", "preferred"],
    imageUrl: "/card-art/amex-blue-cash-preferred.png",
    annualFee: 95,
  },
  {
    keywords: ["blue cash", "everyday"],
    imageUrl: "/card-art/amex-blue-cash-everyday.png",
    annualFee: 0,
  },
  {
    keywords: ["american express", "green"],
    imageUrl: "/card-art/amex-green.png",
    annualFee: 150,
  },
  // Capital One
  {
    keywords: ["venture", "x"],
    imageUrl: "/card-art/venture-x.png",
    annualFee: 395,
  },
  {
    keywords: ["capital one", "venture"],
    imageUrl: "/card-art/venture.png",
    annualFee: 95,
  },
  {
    keywords: ["savorone"],
    imageUrl: "/card-art/savorone.png",
    annualFee: 0,
  },
  {
    keywords: ["savor", "one"],
    imageUrl: "/card-art/savorone.png",
    annualFee: 0,
  },
  {
    keywords: ["quicksilver"],
    imageUrl: "/card-art/quicksilver.png",
    annualFee: 0,
  },
  // Citi
  {
    keywords: ["aadvantage", "platinum"],
    imageUrl: "/card-art/citi-aadvantage-platinum.webp",
    annualFee: 99,
  },
  {
    keywords: ["strata", "elite"],
    imageUrl: "/card-art/citi-strata-elite.webp",
    annualFee: 595,
  },
  {
    keywords: ["strata", "premier"],
    imageUrl: "/card-art/citi-strata-premier.webp",
    annualFee: 95,
  },
  {
    keywords: ["double cash"],
    imageUrl: "/card-art/citi-double-cash.webp",
    annualFee: 0,
  },
  {
    keywords: ["citi", "premier"],
    imageUrl: "/card-art/citi-strata-premier.webp",
    annualFee: 95,
  },
  {
    keywords: ["citi", "strata", "premier"],
    imageUrl: "/card-art/citi-strata-premier.webp",
    annualFee: 95,
  },
  // Apple
  {
    keywords: ["apple", "card"],
    imageUrl: "/card-art/apple-card.jpg",
    annualFee: 0,
  },
  // BILT
  {
    keywords: ["bilt"],
    imageUrl: "",
    annualFee: 0,
  },
  // Discover
  {
    keywords: ["discover", "it"],
    imageUrl: "/card-art/discover-it.png",
    annualFee: 0,
  },
  // Bank of America
  {
    keywords: ["customized", "cash", "rewards"],
    imageUrl: "/card-art/boa-cash-rewards.png",
    annualFee: 0,
  },
  {
    keywords: ["bank of america", "cash"],
    imageUrl: "/card-art/boa-cash-rewards.png",
    annualFee: 0,
  },
  {
    keywords: ["travel", "rewards"],
    imageUrl: "/card-art/boa-travel-rewards.png",
    annualFee: 95,
  },
  {
    keywords: ["premium", "rewards"],
    imageUrl: "/card-art/boa-premium-rewards.png",
    annualFee: 95,
  },
  {
    keywords: ["unlimited", "cash", "rewards"],
    imageUrl: "/card-art/boa-unlimited-cash.png",
    annualFee: 0,
  },
] as const

/**
 * Look up a known card image URL by card name + issuer.
 * Combines issuer and card name for matching so "Platinum Card®" + issuer "American Express"
 * correctly resolves to the Amex Platinum image.
 * More specific matches (more keywords) are preferred over less specific ones.
 */
export function getKnownCardImage(cardName: string, issuer?: string): string | undefined {
  const combined = `${issuer ?? ""} ${cardName}`.toLowerCase()

  let bestMatch: KnownCard | undefined
  let bestKeywordCount = 0

  for (const card of KNOWN_CARDS) {
    const allMatch = card.keywords.every((kw) => combined.includes(kw))
    if (allMatch && card.keywords.length > bestKeywordCount) {
      bestMatch = card
      bestKeywordCount = card.keywords.length
    }
  }

  return bestMatch?.imageUrl || undefined
}

/**
 * Check if a card is in the known cards list (regardless of whether it has an image URL).
 */
export function isInKnownCardsMap(cardName: string, issuer?: string): boolean {
  const combined = `${issuer ?? ""} ${cardName}`.toLowerCase()
  return KNOWN_CARDS.some((card) => card.keywords.every((kw) => combined.includes(kw)))
}

/**
 * Look up a known card annual fee by card name + issuer.
 * Returns undefined if the card is not in the known cards list.
 */
export function getKnownAnnualFee(cardName: string, issuer?: string): number | undefined {
  const combined = `${issuer ?? ""} ${cardName}`.toLowerCase()

  let bestMatch: KnownCard | undefined
  let bestKeywordCount = 0

  for (const card of KNOWN_CARDS) {
    const allMatch = card.keywords.every((kw) => combined.includes(kw))
    if (allMatch && card.keywords.length > bestKeywordCount) {
      bestMatch = card
      bestKeywordCount = card.keywords.length
    }
  }

  return bestMatch?.annualFee
}
