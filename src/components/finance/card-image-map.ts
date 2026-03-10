/**
 * Hardcoded image URLs and annual fees for popular credit cards.
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
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/sapphire_reserve_card_Halo.png",
    annualFee: 550,
  },
  {
    keywords: ["sapphire", "preferred"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/sapphire_preferred_card.png",
    annualFee: 95,
  },
  {
    keywords: ["freedom", "unlimited"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/freedom_unlimited_card_alt.png",
    annualFee: 0,
  },
  {
    keywords: ["freedom", "flex"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/freedom_flex_card_alt.png",
    annualFee: 0,
  },
  {
    keywords: ["prime", "visa"],
    imageUrl: "https://m.media-amazon.com/images/G/01/credit/img21/visa-sig/CBCC_Visa_CardArt_V2_620x388.png",
    annualFee: 0,
  },
  {
    keywords: ["hyatt"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/world_of_hyatt_702x442.png",
    annualFee: 95,
  },
  {
    keywords: ["united", "quest"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/united_quest_702x442.png",
    annualFee: 250,
  },
  {
    keywords: ["united", "explorer"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/united_explorer_702x442.png",
    annualFee: 95,
  },
  {
    keywords: ["united", "business"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/united_explorer_702x442.png",
    annualFee: 99,
  },
  {
    keywords: ["ink", "preferred"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/ink_business_preferred_702x442.png",
    annualFee: 95,
  },
  {
    keywords: ["ink", "unlimited"],
    imageUrl: "https://creditcards.chase.com/content/dam/jpmc-marketplace/card-art/ink_business_unlimited_702x442.png",
    annualFee: 0,
  },
  // Amex
  {
    keywords: ["american express", "platinum"],
    imageUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/platinum-card.png",
    annualFee: 695,
  },
  {
    keywords: ["platinum", "card"],
    imageUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/platinum-card.png",
    annualFee: 695,
  },
  {
    keywords: ["american express", "gold"],
    imageUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/gold-card.png",
    annualFee: 325,
  },
  {
    keywords: ["blue", "business", "plus"],
    imageUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/blue-business-plus.png",
    annualFee: 0,
  },
  {
    keywords: ["blue cash", "preferred"],
    imageUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/blue-cash-preferred.png",
    annualFee: 95,
  },
  {
    keywords: ["blue cash", "everyday"],
    imageUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/blue-cash-everyday.png",
    annualFee: 0,
  },
  {
    keywords: ["american express", "green"],
    imageUrl: "https://icm.aexp-static.com/Internet/Acquisition/US_en/AppContent/OneSite/category/cardarts/green-card.png",
    annualFee: 150,
  },
  // Capital One
  {
    keywords: ["venture", "x"],
    imageUrl: "https://ecm.capitalone.com/WCM/card/products/venture-x-workspace-tabletPC-702x442.png",
    annualFee: 395,
  },
  {
    keywords: ["capital one", "venture"],
    imageUrl: "https://ecm.capitalone.com/WCM/card/products/venture-workspace-tabletPC-702x442.png",
    annualFee: 95,
  },
  {
    keywords: ["savorone"],
    imageUrl: "https://ecm.capitalone.com/WCM/card/products/savorone-workspace-tabletPC-702x442.png",
    annualFee: 0,
  },
  {
    keywords: ["savor", "one"],
    imageUrl: "https://ecm.capitalone.com/WCM/card/products/savorone-workspace-tabletPC-702x442.png",
    annualFee: 0,
  },
  {
    keywords: ["quicksilver"],
    imageUrl: "https://ecm.capitalone.com/WCM/card/products/quicksilver-workspace-tabletPC-702x442.png",
    annualFee: 0,
  },
  // Citi
  {
    keywords: ["double cash"],
    imageUrl: "https://www.citi.com/CRD/images/citi-double-cash/citi-double-cash-credit-card_350x225.png",
    annualFee: 0,
  },
  {
    keywords: ["citi", "premier"],
    imageUrl: "https://www.citi.com/CRD/images/premier/citi-premier-credit-card_350x225.png",
    annualFee: 95,
  },
  // Discover
  {
    keywords: ["discover", "it"],
    imageUrl: "https://www.discover.com/content/dam/discover/en_us/credit-cards/card-acquisitions/grey-redesign/global/images/background/bg-cards-itcards-388-350.png",
    annualFee: 0,
  },
  // Bank of America
  {
    keywords: ["customized", "cash", "rewards"],
    imageUrl: "",
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
