/**
 * Category taxonomy and shared types for the categorization engine.
 */

export const CATEGORIES = {
  "Housing": ["Rent", "Mortgage", "Property Tax", "Home Insurance", "Home Improvement", "HOA"],
  "Transportation": ["Gas", "Parking", "Public Transit", "Rideshare", "Car Payment", "Car Insurance", "Maintenance"],
  "Food & Dining": ["Groceries", "Restaurants", "Coffee", "Fast Food", "Delivery", "Bars"],
  "Shopping": ["Clothing", "Electronics", "Home Goods", "Online Shopping", "Department Store"],
  "Entertainment": ["Streaming", "Gaming", "Movies", "Music", "Events", "Sports"],
  "Health & Fitness": ["Gym", "Pharmacy", "Doctor", "Dentist", "Vision", "Mental Health"],
  "Personal Care": ["Hair", "Spa", "Skincare"],
  "Education": ["Tuition", "Books", "Courses", "Student Loan"],
  "Travel": ["Flights", "Hotels", "Rental Car", "Vacation"],
  "Bills & Utilities": ["Electric", "Water", "Gas", "Internet", "Phone", "Trash"],
  "Fees & Charges": ["Bank Fee", "ATM Fee", "Late Fee", "Interest", "Statement Credit", "Refund"],
  "Business Expenses": ["Office Supplies", "Software", "Marketing", "Travel", "Meals"],
  "Income": ["Salary", "Freelance", "Interest", "Dividends", "Refund", "Reimbursement"],
  "Transfer": ["Bank Transfer", "Venmo", "Zelle", "Cash App", "Wire"],
  "Investment": ["Stock Purchase", "Crypto", "Retirement"],
  "Insurance": ["Home Insurance", "Auto Insurance", "Life Insurance", "Health Insurance"],
  "Gifts & Donations": ["Gifts", "Donations", "Charity"],
  "Crypto": ["Exchange", "DeFi", "NFT"],
  "Taxes": ["Federal", "State", "Local", "Property Tax"],
  "Uncategorized": [],
} as const

export type Category = keyof typeof CATEGORIES

export interface CategoryResult {
  category: string
  subcategory: string | null
}

export interface CategorySuggestion {
  category: string
  subcategory: string | null
  source: "rule" | "plaid" | "merchant_map" | "keyword" | "history" | "top_used"
  confidence: "high" | "medium" | "low"
}

export interface CategoryRule {
  matchType: string
  matchValue: string
  category: string
  subcategory: string | null
  priority: number
}
