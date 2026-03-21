/**
 * Claude API tool schemas for PocketLLM.
 * Describes the 8 read-only financial query tools.
 */

export const TOOL_DEFINITIONS = [
  {
    name: "get_account_balances",
    description: "List all financial accounts with their current balances, types, and institution names.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_spending_summary",
    description: "Get spending grouped by category for a date range. Returns total spent per category.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Start date (YYYY-MM-DD). Defaults to start of current month." },
        endDate: { type: "string", description: "End date (YYYY-MM-DD). Defaults to today." },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_transactions",
    description: "Search and filter transactions. Use to find specific charges, merchants, or spending patterns.",
    input_schema: {
      type: "object" as const,
      properties: {
        search: { type: "string", description: "Search by merchant name or transaction description." },
        category: { type: "string", description: "Filter by category name." },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD)." },
        endDate: { type: "string", description: "End date (YYYY-MM-DD)." },
        limit: { type: "number", description: "Max results (default 20, max 50)." },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_budget_status",
    description: "Get all active budgets with current month spending, remaining amount, and percent used.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_subscriptions",
    description: "List active subscriptions with amounts, frequency, and next charge dates.",
    input_schema: {
      type: "object" as const,
      properties: {
        includeInactive: { type: "boolean", description: "Include cancelled subscriptions (default false)." },
      },
      required: [] as string[],
    },
  },
  {
    name: "get_net_worth",
    description: "Get the latest net worth snapshot with total assets, total debt, and net worth.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_investments",
    description: "Get investment holdings with security names, quantities, current values, and cost basis.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_credit_cards",
    description: "List credit card profiles with rewards type, points/cashback balance, annual fee, and bonus categories.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
]
