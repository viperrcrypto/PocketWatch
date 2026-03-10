/**
 * Built-in merchant-to-category lookup map (~200 common merchants).
 */

import type { CategoryResult } from "./category-types"

export const MERCHANT_MAP: Record<string, CategoryResult> = {
  // Streaming
  "NETFLIX": { category: "Entertainment", subcategory: "Streaming" },
  "HULU": { category: "Entertainment", subcategory: "Streaming" },
  "DISNEY+": { category: "Entertainment", subcategory: "Streaming" },
  "DISNEY PLUS": { category: "Entertainment", subcategory: "Streaming" },
  "HBO MAX": { category: "Entertainment", subcategory: "Streaming" },
  "SPOTIFY": { category: "Entertainment", subcategory: "Music" },
  "APPLE MUSIC": { category: "Entertainment", subcategory: "Music" },
  "YOUTUBE": { category: "Entertainment", subcategory: "Streaming" },
  "PARAMOUNT": { category: "Entertainment", subcategory: "Streaming" },
  "PEACOCK": { category: "Entertainment", subcategory: "Streaming" },
  "CRUNCHYROLL": { category: "Entertainment", subcategory: "Streaming" },
  // Food delivery
  "UBER EATS": { category: "Food & Dining", subcategory: "Delivery" },
  "DOORDASH": { category: "Food & Dining", subcategory: "Delivery" },
  "GRUBHUB": { category: "Food & Dining", subcategory: "Delivery" },
  "POSTMATES": { category: "Food & Dining", subcategory: "Delivery" },
  "INSTACART": { category: "Food & Dining", subcategory: "Groceries" },
  // Groceries
  "TRADER JOE": { category: "Food & Dining", subcategory: "Groceries" },
  "WHOLE FOODS": { category: "Food & Dining", subcategory: "Groceries" },
  "SAFEWAY": { category: "Food & Dining", subcategory: "Groceries" },
  "KROGER": { category: "Food & Dining", subcategory: "Groceries" },
  "COSTCO": { category: "Food & Dining", subcategory: "Groceries" },
  "WALMART": { category: "Shopping", subcategory: "Department Store" },
  "TARGET": { category: "Shopping", subcategory: "Department Store" },
  "ALDI": { category: "Food & Dining", subcategory: "Groceries" },
  "PUBLIX": { category: "Food & Dining", subcategory: "Groceries" },
  "HEB": { category: "Food & Dining", subcategory: "Groceries" },
  "SPROUTS": { category: "Food & Dining", subcategory: "Groceries" },
  // Fast food / coffee
  "STARBUCKS": { category: "Food & Dining", subcategory: "Coffee" },
  "DUNKIN": { category: "Food & Dining", subcategory: "Coffee" },
  "MCDONALD": { category: "Food & Dining", subcategory: "Fast Food" },
  "CHICK-FIL-A": { category: "Food & Dining", subcategory: "Fast Food" },
  "CHIPOTLE": { category: "Food & Dining", subcategory: "Fast Food" },
  "SUBWAY": { category: "Food & Dining", subcategory: "Fast Food" },
  "TACO BELL": { category: "Food & Dining", subcategory: "Fast Food" },
  "WENDY": { category: "Food & Dining", subcategory: "Fast Food" },
  "BURGER KING": { category: "Food & Dining", subcategory: "Fast Food" },
  "PANDA EXPRESS": { category: "Food & Dining", subcategory: "Fast Food" },
  "POPEYES": { category: "Food & Dining", subcategory: "Fast Food" },
  // Transport
  "UBER": { category: "Transportation", subcategory: "Rideshare" },
  "LYFT": { category: "Transportation", subcategory: "Rideshare" },
  "SHELL": { category: "Transportation", subcategory: "Gas" },
  "CHEVRON": { category: "Transportation", subcategory: "Gas" },
  "EXXON": { category: "Transportation", subcategory: "Gas" },
  "BP": { category: "Transportation", subcategory: "Gas" },
  "TEXACO": { category: "Transportation", subcategory: "Gas" },
  // Shopping
  "AMAZON": { category: "Shopping", subcategory: "Online Shopping" },
  "AMZN": { category: "Shopping", subcategory: "Online Shopping" },
  "APPLE.COM": { category: "Shopping", subcategory: "Electronics" },
  "APPLE": { category: "Shopping", subcategory: "Electronics" },
  "FEDEX": { category: "Shopping", subcategory: "Shipping" },
  "UPS": { category: "Shopping", subcategory: "Shipping" },
  "USPS": { category: "Shopping", subcategory: "Shipping" },
  "BEST BUY": { category: "Shopping", subcategory: "Electronics" },
  "IKEA": { category: "Shopping", subcategory: "Home Goods" },
  "HOME DEPOT": { category: "Housing", subcategory: "Home Improvement" },
  "LOWES": { category: "Housing", subcategory: "Home Improvement" },
  "NORDSTROM": { category: "Shopping", subcategory: "Clothing" },
  "NIKE": { category: "Shopping", subcategory: "Clothing" },
  "ZARA": { category: "Shopping", subcategory: "Clothing" },
  "H&M": { category: "Shopping", subcategory: "Clothing" },
  "UNIQLO": { category: "Shopping", subcategory: "Clothing" },
  "ETSY": { category: "Shopping", subcategory: "Online Shopping" },
  "EBAY": { category: "Shopping", subcategory: "Online Shopping" },
  // Health
  "CVS": { category: "Health & Fitness", subcategory: "Pharmacy" },
  "WALGREENS": { category: "Health & Fitness", subcategory: "Pharmacy" },
  "RITE AID": { category: "Health & Fitness", subcategory: "Pharmacy" },
  "PLANET FITNESS": { category: "Health & Fitness", subcategory: "Gym" },
  "EQUINOX": { category: "Health & Fitness", subcategory: "Gym" },
  "ORANGETHEORY": { category: "Health & Fitness", subcategory: "Gym" },
  // Bills
  "AT&T": { category: "Bills & Utilities", subcategory: "Phone" },
  "VERIZON": { category: "Bills & Utilities", subcategory: "Phone" },
  "T-MOBILE": { category: "Bills & Utilities", subcategory: "Phone" },
  "COMCAST": { category: "Bills & Utilities", subcategory: "Internet" },
  "XFINITY": { category: "Bills & Utilities", subcategory: "Internet" },
  "SPECTRUM": { category: "Bills & Utilities", subcategory: "Internet" },
  // Software/subscriptions
  "TELEGRAM": { category: "Entertainment", subcategory: "Messaging" },
  "DISCORD": { category: "Entertainment", subcategory: "Gaming" },
  "X CORP": { category: "Entertainment", subcategory: "Social Media" },
  "SIRIUS XM": { category: "Entertainment", subcategory: "Music" },
  "SIRIUSXM": { category: "Entertainment", subcategory: "Music" },
  "RING": { category: "Bills & Utilities", subcategory: "Security" },
  "NUMERO ESIM": { category: "Bills & Utilities", subcategory: "Phone" },
  "SONIC INTERNET": { category: "Bills & Utilities", subcategory: "Internet" },
  "ROCKET MONEY": { category: "Bills & Utilities", subcategory: "Financial Services" },
  "GOBRANDSINC": { category: "Shopping", subcategory: "Online Shopping" },
  "CHATGPT": { category: "Business Expenses", subcategory: "Software" },
  "OPENAI": { category: "Business Expenses", subcategory: "Software" },
  "GITHUB": { category: "Business Expenses", subcategory: "Software" },
  "NOTION": { category: "Business Expenses", subcategory: "Software" },
  "SLACK": { category: "Business Expenses", subcategory: "Software" },
  "ZOOM": { category: "Business Expenses", subcategory: "Software" },
  "DROPBOX": { category: "Business Expenses", subcategory: "Software" },
  "GOOGLE STORAGE": { category: "Business Expenses", subcategory: "Software" },
  "ICLOUD": { category: "Bills & Utilities", subcategory: "Internet" },
  "ADOBE": { category: "Business Expenses", subcategory: "Software" },
  // Transfers
  "VENMO": { category: "Transfer", subcategory: "Venmo" },
  "ZELLE": { category: "Transfer", subcategory: "Zelle" },
  "CASH APP": { category: "Transfer", subcategory: "Cash App" },
  "PAYPAL": { category: "Transfer", subcategory: null },
  // Travel
  "AIRBNB": { category: "Travel", subcategory: "Hotels" },
  "MARRIOTT": { category: "Travel", subcategory: "Hotels" },
  "HILTON": { category: "Travel", subcategory: "Hotels" },
  "DELTA AIR": { category: "Travel", subcategory: "Flights" },
  "UNITED AIR": { category: "Travel", subcategory: "Flights" },
  "AMERICAN AIR": { category: "Travel", subcategory: "Flights" },
  "SOUTHWEST": { category: "Travel", subcategory: "Flights" },
  "JETBLUE": { category: "Travel", subcategory: "Flights" },
  // Insurance
  "GEICO": { category: "Insurance", subcategory: "Auto Insurance" },
  "STATE FARM": { category: "Insurance", subcategory: "Auto Insurance" },
  "PROGRESSIVE": { category: "Insurance", subcategory: "Auto Insurance" },
  "ALLSTATE": { category: "Insurance", subcategory: null },
  "AMERICAN INCOME LIFE": { category: "Insurance", subcategory: "Life Insurance" },
  "INCOME LIFE": { category: "Insurance", subcategory: "Life Insurance" },
  "FLEX COMPENSATIO": { category: "Insurance", subcategory: "COBRA" },
  "FLEX COMPENSATION": { category: "Insurance", subcategory: "COBRA" },
  "AFLAC": { category: "Insurance", subcategory: null },
  "CIGNA": { category: "Insurance", subcategory: "Health Insurance" },
  "AETNA": { category: "Insurance", subcategory: "Health Insurance" },
  "HUMANA": { category: "Insurance", subcategory: "Health Insurance" },
  "UNITED HEALTH": { category: "Insurance", subcategory: "Health Insurance" },
  "BLUE CROSS": { category: "Insurance", subcategory: "Health Insurance" },
  "BLUE SHIELD": { category: "Insurance", subcategory: "Health Insurance" },
  "KAISER": { category: "Insurance", subcategory: "Health Insurance" },
  "AAA": { category: "Insurance", subcategory: "Roadside Assistance" },
  "NAVIA BENEFIT": { category: "Insurance", subcategory: "Benefits Administration" },
  // Rental cars
  "ENTERPRISE": { category: "Travel", subcategory: "Rental Car" },
  "HERTZ": { category: "Travel", subcategory: "Rental Car" },
  "NATIONAL CAR": { category: "Travel", subcategory: "Rental Car" },
  // Airlines
  "SPIRIT AIR": { category: "Travel", subcategory: "Flights" },
  "FRONTIER AIR": { category: "Travel", subcategory: "Flights" },
  "ALASKA AIR": { category: "Travel", subcategory: "Flights" },
  // Hotels
  "HYATT": { category: "Travel", subcategory: "Hotels" },
  "IHG": { category: "Travel", subcategory: "Hotels" },
  "WYNDHAM": { category: "Travel", subcategory: "Hotels" },
  "BEST WESTERN": { category: "Travel", subcategory: "Hotels" },
  "BOOKING.COM": { category: "Travel", subcategory: "Hotels" },
  // Travel aggregators
  "EXPEDIA": { category: "Travel", subcategory: null },
  "TRAVELOCITY": { category: "Travel", subcategory: null },
  "KAYAK": { category: "Travel", subcategory: null },
  // Investment & Brokerage
  "ROBINHOOD": { category: "Investment", subcategory: "Stock Purchase" },
  "FIDELITY": { category: "Investment", subcategory: "Stock Purchase" },
  "SCHWAB": { category: "Investment", subcategory: "Stock Purchase" },
  "CHARLES SCHWAB": { category: "Investment", subcategory: "Stock Purchase" },
  "VANGUARD": { category: "Investment", subcategory: "Retirement" },
  "EMPOWER": { category: "Investment", subcategory: null },
  "COINBASE": { category: "Investment", subcategory: "Crypto" },
  "KRAKEN": { category: "Investment", subcategory: "Crypto" },
  "GEMINI": { category: "Investment", subcategory: "Crypto" },
  "WEBULL": { category: "Investment", subcategory: "Stock Purchase" },
  "FUTRINC": { category: "Investment", subcategory: "Stock Purchase" },
  "FUTURINC": { category: "Investment", subcategory: "Stock Purchase" },
  "MORGAN STANLEY": { category: "Investment", subcategory: "Brokerage" },
  "ETRADE": { category: "Investment", subcategory: "Stock Purchase" },
  "E*TRADE": { category: "Investment", subcategory: "Stock Purchase" },
  "WEALTHFRONT": { category: "Investment", subcategory: "Stock Purchase" },
  "BETTERMENT": { category: "Investment", subcategory: "Stock Purchase" },
  "ACORNS": { category: "Investment", subcategory: "Stock Purchase" },
  // Credit card payments
  "PAYMENT THANK YOU": { category: "Transfer", subcategory: "Bank Transfer" },
  "AUTOPAY": { category: "Transfer", subcategory: "Bank Transfer" },
  "AUTOMATIC PAYMENT": { category: "Transfer", subcategory: "Bank Transfer" },
  "BILL PAY": { category: "Transfer", subcategory: "Bank Transfer" },
  // Additional groceries
  "ALBERTSONS": { category: "Food & Dining", subcategory: "Groceries" },
  "GIANT": { category: "Food & Dining", subcategory: "Groceries" },
  "FOOD LION": { category: "Food & Dining", subcategory: "Groceries" },
  "WEGMANS": { category: "Food & Dining", subcategory: "Groceries" },
  "WINCO": { category: "Food & Dining", subcategory: "Groceries" },
  "MEIJER": { category: "Food & Dining", subcategory: "Groceries" },
  "PIGGLY WIGGLY": { category: "Food & Dining", subcategory: "Groceries" },
  "HARRIS TEETER": { category: "Food & Dining", subcategory: "Groceries" },
  "STOP & SHOP": { category: "Food & Dining", subcategory: "Groceries" },
  "FOOD 4 LESS": { category: "Food & Dining", subcategory: "Groceries" },
  "SAM'S CLUB": { category: "Shopping", subcategory: "Department Store" },
}

// Pre-sorted entries for longest-match-first (prevents "UBER" matching before "UBER EATS")
const SORTED_MERCHANT_ENTRIES = Object.entries(MERCHANT_MAP)
  .sort((a, b) => b[0].length - a[0].length)

/**
 * Look up merchant in built-in map (partial match, longest key first).
 */
export function matchMerchantMap(merchantName: string): CategoryResult | null {
  const upper = merchantName.toUpperCase()

  // Try exact key match first
  if (MERCHANT_MAP[upper]) return MERCHANT_MAP[upper]

  // Try partial match, longest key first
  for (const [key, result] of SORTED_MERCHANT_ENTRIES) {
    if (upper.includes(key)) return result
  }

  return null
}
