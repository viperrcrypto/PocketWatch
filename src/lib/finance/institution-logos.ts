/**
 * Institution logo resolution with static map + Google favicon fallback.
 */

// Common Plaid institution IDs mapped to logo URLs
// These are the most common US banks in Plaid Sandbox and production
const INSTITUTION_LOGOS: Record<string, string> = {
  // Plaid institution IDs → high-quality logo URLs
  ins_3: "https://www.google.com/s2/favicons?sz=128&domain=chase.com",
  ins_4: "https://www.google.com/s2/favicons?sz=128&domain=wellsfargo.com",
  ins_5: "https://www.google.com/s2/favicons?sz=128&domain=bankofamerica.com",
  ins_6: "https://www.google.com/s2/favicons?sz=128&domain=citi.com",
  ins_10: "https://www.google.com/s2/favicons?sz=128&domain=americanexpress.com",
  ins_12: "https://www.google.com/s2/favicons?sz=128&domain=fidelity.com",
  ins_13: "https://www.google.com/s2/favicons?sz=128&domain=schwab.com",
  ins_14: "https://www.google.com/s2/favicons?sz=128&domain=tdbank.com",
  ins_15: "https://www.google.com/s2/favicons?sz=128&domain=usbank.com",
  ins_16: "https://www.google.com/s2/favicons?sz=128&domain=capitalone.com",
  ins_19: "https://www.google.com/s2/favicons?sz=128&domain=pnc.com",
  ins_20: "https://www.google.com/s2/favicons?sz=128&domain=ally.com",
  ins_21: "https://www.google.com/s2/favicons?sz=128&domain=discover.com",
  ins_25: "https://www.google.com/s2/favicons?sz=128&domain=marcus.com",
  ins_27: "https://www.google.com/s2/favicons?sz=128&domain=navyfederal.org",
  ins_29: "https://www.google.com/s2/favicons?sz=128&domain=suntrust.com",
  ins_32: "https://www.google.com/s2/favicons?sz=128&domain=regions.com",
  ins_33: "https://www.google.com/s2/favicons?sz=128&domain=53.com",
  ins_34: "https://www.google.com/s2/favicons?sz=128&domain=keybank.com",
  ins_35: "https://www.google.com/s2/favicons?sz=128&domain=citizensbank.com",
  ins_100103: "https://www.google.com/s2/favicons?sz=128&domain=sofi.com",
  ins_100089: "https://www.google.com/s2/favicons?sz=128&domain=chime.com",
  ins_116284: "https://www.google.com/s2/favicons?sz=128&domain=venmo.com",
  ins_127989: "https://www.google.com/s2/favicons?sz=128&domain=robinhood.com",
}

// Institution name → domain mapping for Google favicon fallback
const NAME_TO_DOMAIN: Record<string, string> = {
  "chase": "chase.com",
  "bank of america": "bankofamerica.com",
  "wells fargo": "wellsfargo.com",
  "citi": "citi.com",
  "citibank": "citi.com",
  "capital one": "capitalone.com",
  "american express": "americanexpress.com",
  "amex": "americanexpress.com",
  "discover": "discover.com",
  "us bank": "usbank.com",
  "pnc": "pnc.com",
  "td bank": "tdbank.com",
  "ally": "ally.com",
  "ally bank": "ally.com",
  "navy federal": "navyfederal.org",
  "usaa": "usaa.com",
  "fidelity": "fidelity.com",
  "charles schwab": "schwab.com",
  "schwab": "schwab.com",
  "goldman sachs": "marcus.com",
  "marcus": "marcus.com",
  "sofi": "sofi.com",
  "chime": "chime.com",
  "robinhood": "robinhood.com",
  "vanguard": "vanguard.com",
  "regions": "regions.com",
  "fifth third": "53.com",
  "key bank": "keybank.com",
  "keybank": "keybank.com",
  "citizens": "citizensbank.com",
  "citizens bank": "citizensbank.com",
  "truist": "truist.com",
  "huntington": "huntington.com",
  "m&t bank": "mtb.com",
  "bmo": "bmo.com",
  "wealthfront": "wealthfront.com",
  "betterment": "betterment.com",
  "paypal": "paypal.com",
  "venmo": "venmo.com",
}

/**
 * Resolve institution logo. Fallback chain:
 * 1. Plaid-provided logo URL
 * 2. Static institution ID map
 * 3. Google favicon from institution name
 * 4. null
 */
export function resolveInstitutionLogo(
  plaidLogo: string | null | undefined,
  institutionId: string | null | undefined,
  institutionName: string
): string | null {
  // 1. Plaid logo — accept base64-encoded images (Plaid often returns raw base64 PNG)
  if (plaidLogo && plaidLogo.length > 100 && !plaidLogo.startsWith("http")) {
    return `data:image/png;base64,${plaidLogo}`
  }

  // 1b. Plaid logo URL (http/https)
  if (plaidLogo && (plaidLogo.startsWith("http://") || plaidLogo.startsWith("https://"))) {
    return plaidLogo
  }

  // 2. Static map by institution ID
  if (institutionId && INSTITUTION_LOGOS[institutionId]) {
    return INSTITUTION_LOGOS[institutionId]
  }

  // 3. Clearbit from institution name
  const nameLower = institutionName.toLowerCase().trim()
  const domain = NAME_TO_DOMAIN[nameLower]
  if (domain) {
    return `https://www.google.com/s2/favicons?sz=128&domain=${domain}`
  }

  // Try partial match
  for (const [key, dom] of Object.entries(NAME_TO_DOMAIN)) {
    if (nameLower.includes(key)) {
      return `https://www.google.com/s2/favicons?sz=128&domain=${dom}`
    }
  }

  return null
}
