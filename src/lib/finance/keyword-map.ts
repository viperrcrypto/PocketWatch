/**
 * Keyword-based fallback matching for transaction categorization.
 */

import type { CategoryResult } from "./category-types"

const KEYWORD_MAP: Array<{ keywords: string[]; result: CategoryResult }> = [
  { keywords: ["restaurant", "grill", "kitchen", "bistro", "cafe", "diner", "eatery", "sushi", "pizza", "thai", "chinese", "mexican", "italian", "indian"], result: { category: "Food & Dining", subcategory: "Restaurants" } },
  { keywords: ["pharmacy", "rx", "drug"], result: { category: "Health & Fitness", subcategory: "Pharmacy" } },
  { keywords: ["gym", "fitness", "yoga"], result: { category: "Health & Fitness", subcategory: "Gym" } },
  { keywords: ["parking", "park meter"], result: { category: "Transportation", subcategory: "Parking" } },
  { keywords: ["gas station", "fuel", "petrol"], result: { category: "Transportation", subcategory: "Gas" } },
  { keywords: ["grocery", "market", "supermarket", "food store"], result: { category: "Food & Dining", subcategory: "Groceries" } },
  { keywords: ["hotel", "motel", "resort", "inn"], result: { category: "Travel", subcategory: "Hotels" } },
  { keywords: ["airline", "flight", "airways"], result: { category: "Travel", subcategory: "Flights" } },
  { keywords: ["annual fee", "annual membership fee", "card member fee", "cardmember fee"], result: { category: "Fees & Charges", subcategory: "Annual Fee" } },
  { keywords: ["cobra", "flex compensat"], result: { category: "Insurance", subcategory: "COBRA" } },
  { keywords: ["life insurance", "whole life", "term life", "american income", "income life"], result: { category: "Insurance", subcategory: "Life Insurance" } },
  { keywords: ["auto insurance", "car insurance"], result: { category: "Insurance", subcategory: "Auto Insurance" } },
  { keywords: ["health insurance", "dental insurance", "vision insurance"], result: { category: "Insurance", subcategory: "Health Insurance" } },
  { keywords: ["roadside"], result: { category: "Insurance", subcategory: "Roadside Assistance" } },
  { keywords: ["insurance"], result: { category: "Insurance", subcategory: null } },
  { keywords: ["electric", "power", "energy"], result: { category: "Bills & Utilities", subcategory: "Electric" } },
  { keywords: ["water utility", "water dept"], result: { category: "Bills & Utilities", subcategory: "Water" } },
  { keywords: ["rent", "lease", "apartment"], result: { category: "Housing", subcategory: "Rent" } },
  { keywords: ["atm", "withdrawal"], result: { category: "Transfer", subcategory: "Bank Transfer" } },
  { keywords: ["interest charge", "finance charge"], result: { category: "Fees & Charges", subcategory: "Interest" } },
  { keywords: ["direct deposit", "payroll", "salary", "wages"], result: { category: "Income", subcategory: "Salary" } },
  { keywords: ["payment to", "credit card", "card ending in", "bill pay", "autopay"], result: { category: "Transfer", subcategory: "Bank Transfer" } },
  { keywords: ["brokerage", "invest", "trading"], result: { category: "Investment", subcategory: null } },
  { keywords: ["dividend", "interest earned"], result: { category: "Income", subcategory: "Dividends" } },
  { keywords: ["refund", "return", "credit memo", "reimbursement"], result: { category: "Income", subcategory: "Refund" } },
  { keywords: ["car rental", "rent a car"], result: { category: "Travel", subcategory: "Rental Car" } },
  { keywords: ["toll", "ez pass", "fastrak", "sunpass"], result: { category: "Transportation", subcategory: null } },
  { keywords: ["wire transfer", "ach transfer", "ach payment", "ach deposit", "external transfer"], result: { category: "Transfer", subcategory: "Bank Transfer" } },
  { keywords: ["tsa", "precheck", "global entry", "nexus"], result: { category: "Travel", subcategory: null } },
  { keywords: ["subscription", "recurring", "membership"], result: { category: "Bills & Utilities", subcategory: null } },
  { keywords: ["psychiatr", "therapist", "therapy", "counseling", "mental health", "psycholog"], result: { category: "Health & Fitness", subcategory: "Mental Health" } },
  { keywords: ["benefit", "benefits", "hsa", "fsa"], result: { category: "Health & Fitness", subcategory: null } },
  { keywords: ["income life", "life insurance", "whole life", "term life"], result: { category: "Bills & Utilities", subcategory: "Insurance" } },
  { keywords: ["chase credit crd", "epay"], result: { category: "Transfer", subcategory: "Bank Transfer" } },
  { keywords: ["management", "property mgmt", "ny management", "managemen"], result: { category: "Housing", subcategory: "Rent" } },
  { keywords: ["rocket money", "truebill"], result: { category: "Bills & Utilities", subcategory: "Financial Services" } },
]

/**
 * Match a merchant name against keyword patterns.
 */
export function matchKeywords(merchantName: string): CategoryResult | null {
  const lower = merchantName.toLowerCase()

  for (const entry of KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      if (lower.includes(keyword)) return entry.result
    }
  }

  return null
}
