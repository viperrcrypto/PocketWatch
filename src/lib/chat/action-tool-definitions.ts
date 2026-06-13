/**
 * Claude API tool schemas for PocketLLM finance ACTION (write) tools and
 * crypto PORTFOLIO read tools. Spread into TOOL_DEFINITIONS in tool-definitions.ts.
 * Executors live in finance-action-tools.ts and portfolio-tools.ts.
 */

export const ACTION_TOOL_DEFINITIONS = [
  {
    name: "create_budget",
    description: "Create or update a monthly budget for a spending category. Upserts by category — calling it for an existing category updates that budget's limit.",
    input_schema: {
      type: "object" as const,
      properties: {
        category: { type: "string", description: "Spending category name (e.g. 'Groceries'). Required." },
        monthlyLimit: { type: "number", description: "Positive monthly spending limit in USD. Required." },
        rollover: { type: "boolean", description: "Roll unused budget into next month (default false)." },
      },
      required: ["category", "monthlyLimit"],
    },
  },
  {
    name: "update_budget",
    description: "Update an existing budget's monthly limit, rollover flag, or active state.",
    input_schema: {
      type: "object" as const,
      properties: {
        budgetId: { type: "string", description: "ID of the budget to update. Required." },
        monthlyLimit: { type: "number", description: "New positive monthly limit in USD." },
        rollover: { type: "boolean", description: "Roll unused budget into next month." },
        isActive: { type: "boolean", description: "Whether the budget is active." },
      },
      required: ["budgetId"],
    },
  },
  {
    name: "set_transaction_category",
    description: "Recategorize a transaction — set its category (and optionally subcategory). Modifies data; do it on a clear instruction.",
    input_schema: {
      type: "object" as const,
      properties: {
        transactionId: { type: "string", description: "ID of the transaction. Required." },
        category: { type: "string", description: "New category name. Required." },
        subcategory: { type: "string", description: "Optional subcategory name." },
      },
      required: ["transactionId", "category"],
    },
  },
  {
    name: "exclude_transaction",
    description: "Exclude or re-include a transaction from spending/budget totals. Modifies data; do it on a clear instruction.",
    input_schema: {
      type: "object" as const,
      properties: {
        transactionId: { type: "string", description: "ID of the transaction. Required." },
        excluded: { type: "boolean", description: "true to exclude, false to re-include. Required." },
      },
      required: ["transactionId", "excluded"],
    },
  },
  {
    name: "mark_bill_paid",
    description: "Mark a bill as paid or unpaid. Provide exactly ONE of billId (a subscription/recurring bill) or creditCardId (a credit-card liability). Modifies data; do it on a clear instruction.",
    input_schema: {
      type: "object" as const,
      properties: {
        billId: { type: "string", description: "ID of a subscription/recurring bill. Provide this OR creditCardId, not both." },
        creditCardId: { type: "string", description: "ID of a credit-card liability. Provide this OR billId, not both." },
        paid: { type: "boolean", description: "true to mark paid, false to mark unpaid. Required." },
      },
      required: ["paid"],
    },
  },
  {
    name: "get_portfolio_balances",
    description: "Get the user's crypto holdings (tokens by chain with USD value) as a compact top-N list by value. Returns a { type: 'holdings', holdings: [...] } envelope plus totals and chain distribution.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_staking_positions",
    description: "Get the user's active crypto staking / DeFi yield positions with protocol, value, APY, and annual yield, plus totals.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_wallet_pnl",
    description: "Get realized profit/loss across the user's wallets, aggregated overall and per asset (proceeds, cost basis, gain).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_portfolio_history",
    description: "Get the user's net-worth (portfolio value) history as a compact series of time-stamped points for a range, plus the change over the range.",
    input_schema: {
      type: "object" as const,
      properties: {
        range: { type: "string", description: "Time range: 1D, 1W, 1M (default), 3M, 1Y, or ALL." },
      },
      required: [] as string[],
    },
  },
  {
    name: "trigger_portfolio_refresh",
    description: "Kick off a fresh portfolio data refresh (balances/snapshots) in the background. Non-destructive — safe to call when the user wants up-to-date numbers.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
]
