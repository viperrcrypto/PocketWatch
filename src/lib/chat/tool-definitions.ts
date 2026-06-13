/**
 * Claude API tool schemas for PocketLLM.
 * Read-only finance/travel query tools here; finance-action + portfolio tool
 * schemas are appended from action-tool-definitions.ts.
 */

import { ACTION_TOOL_DEFINITIONS } from "./action-tool-definitions"

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
  {
    name: "get_flight_search_summary",
    description: "Get a summary of the user's most recent flight search — route, dates, total flights found, cabin/airline breakdowns, price ranges, recommendations, and points balances. Call this first when the user asks about flights.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_flight_results",
    description: "Search and filter the user's most recent flight search results. Returns matching flights with pricing, value scores, and booking links.",
    input_schema: {
      type: "object" as const,
      properties: {
        cabin: { type: "string", description: "Filter by cabin class: economy, premium_economy, business, or first." },
        airline: { type: "string", description: "Filter by airline name (case-insensitive partial match)." },
        type: { type: "string", description: "Filter by type: award or cash." },
        stops: { type: "number", description: "Maximum number of stops (0 for nonstop, 1, 2)." },
        max_points: { type: "number", description: "Maximum points cost." },
        min_value_score: { type: "number", description: "Minimum value score (0-100)." },
        sort_by: { type: "string", description: "Sort by: value_score (default), points, cash_price, duration, or cpp." },
        limit: { type: "number", description: "Max results to return (default 10, max 30)." },
      },
      required: [] as string[],
    },
  },
  {
    name: "generate_price_match_email",
    description: "Generate a price match / negotiation email based on flight search results. Finds the cheapest competitor fare and drafts a persuasive email to request a price match from another airline.",
    input_schema: {
      type: "object" as const,
      properties: {
        airline: { type: "string", description: "Target airline to send the price match request to (optional — uses the most expensive if omitted)." },
      },
      required: [] as string[],
    },
  },
  {
    name: "analyze_fare_details",
    description: "Analyze fare flexibility (refundable? changeable? change fees?) and estimate ancillary fees (bags, seats) for flights in the search results. Use when the user asks about cancellation policies, change fees, baggage costs, or total trip cost.",
    input_schema: {
      type: "object" as const,
      properties: {
        airline: { type: "string", description: "Filter by airline name." },
        cabin: { type: "string", description: "Filter by cabin class: economy, business, first." },
      },
      required: [] as string[],
    },
  },
  {
    name: "search_flights_live",
    description: "Run a FRESH live flight search across all connected award + cash providers. Use this when the user asks for a new search or different dates/route. Returns a compact summary of the top ~8 flights and saves them as the latest search for follow-up filtering with get_flight_results.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string", description: "Origin 3-letter IATA code (e.g. LAX)." },
        destination: { type: "string", description: "Destination 3-letter IATA code (e.g. LHR)." },
        departureDate: { type: "string", description: "Departure date (YYYY-MM-DD)." },
        returnDate: { type: "string", description: "Return date (YYYY-MM-DD). Required when tripType is round_trip." },
        searchClass: { type: "string", description: "Cabin: ECON, PREM_ECON, BIZ, FIRST, or both. Defaults to BIZ." },
        tripType: { type: "string", description: "one_way (default) or round_trip." },
        flexDates: { type: "boolean", description: "Search +/- a few days around the date for better deals." },
      },
      required: ["origin", "destination", "departureDate"],
    },
  },
  {
    name: "search_hotels_live",
    description: "Run a FRESH live hotel search (cash + points) for a city or hotel name. Returns the top ~8 hotels with nightly cash/points pricing and a booking link.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "City or hotel name (e.g. 'Miami' or 'Park Hyatt Tokyo')." },
        checkIn: { type: "string", description: "Check-in date (YYYY-MM-DD)." },
        checkOut: { type: "string", description: "Check-out date (YYYY-MM-DD)." },
        adults: { type: "number", description: "Number of adults (default 2, max 8)." },
      },
      required: ["query", "checkIn", "checkOut"],
    },
  },
  {
    name: "get_points_balances",
    description: "Get the user's loyalty / transferable points balances derived from their credit card profiles.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "list_trips",
    description: "List the user's saved trips (name, destination, dates, status).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "create_trip",
    description: "Create a new trip to organize flights, hotels, and expenses. Use after a search when the user wants to plan a trip.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Trip name (e.g. 'Tokyo Spring 2026'). Required." },
        startDate: { type: "string", description: "Start date (YYYY-MM-DD). Required." },
        destination: { type: "string", description: "Destination city or place." },
        endDate: { type: "string", description: "End date (YYYY-MM-DD), on or after start date." },
        notes: { type: "string", description: "Free-form notes." },
      },
      required: ["name", "startDate"],
    },
  },
  {
    name: "update_trip",
    description: "Update an existing trip's name, destination, dates, status, or notes.",
    input_schema: {
      type: "object" as const,
      properties: {
        tripId: { type: "string", description: "ID of the trip to update. Required." },
        name: { type: "string", description: "New trip name." },
        destination: { type: "string", description: "New destination." },
        startDate: { type: "string", description: "New start date (YYYY-MM-DD)." },
        endDate: { type: "string", description: "New end date (YYYY-MM-DD)." },
        status: { type: "string", description: "upcoming, active, or past." },
        notes: { type: "string", description: "Updated notes." },
      },
      required: ["tripId"],
    },
  },
  {
    name: "get_trip_briefing",
    description: "Get a travel-day briefing for a trip: destination weather forecast, the next upcoming flight segment, and packing/timing tips.",
    input_schema: {
      type: "object" as const,
      properties: {
        tripId: { type: "string", description: "ID of the trip. Required." },
      },
      required: ["tripId"],
    },
  },
  {
    name: "get_trip_expenses",
    description: "Get the spend summary for a trip: total, transaction count, and per-category breakdown of tagged expenses.",
    input_schema: {
      type: "object" as const,
      properties: {
        tripId: { type: "string", description: "ID of the trip. Required." },
      },
      required: ["tripId"],
    },
  },
  {
    name: "create_saved_route",
    description: "Save a route for price tracking / alerts. Use when the user wants to be alerted when a fare drops.",
    input_schema: {
      type: "object" as const,
      properties: {
        origin: { type: "string", description: "Origin airport code or city name. Required." },
        destination: { type: "string", description: "Destination airport code or city name. Required." },
        departureDate: { type: "string", description: "Departure date (YYYY-MM-DD). Required." },
        returnDate: { type: "string", description: "Return date (YYYY-MM-DD). Required for round_trip." },
        tripType: { type: "string", description: "one_way (default) or round_trip." },
        searchClass: { type: "string", description: "ECON (default), PREM_ECON, BIZ, FIRST, or both." },
        alertThreshold: { type: "number", description: "Alert when price drops at or below this value." },
        thresholdType: { type: "string", description: "cash (default) or points." },
      },
      required: ["origin", "destination", "departureDate"],
    },
  },
  {
    name: "list_saved_routes",
    description: "List the user's saved price-tracking routes with their alert thresholds and last observed prices.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "get_traveler_profile",
    description: "Get the user's traveler profile: loyalty programs, seat/cabin preferences, and MASKED passport / Known Traveler Number (last 4 only).",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [] as string[],
    },
  },
  {
    name: "update_traveler_profile",
    description: "Update the user's traveler profile. Omitted passport/KTN fields are kept as-is (never cleared). Only send passportNumber/knownTravelerNumber when the user provides a NEW value.",
    input_schema: {
      type: "object" as const,
      properties: {
        loyaltyPrograms: {
          type: "array",
          description: "Loyalty programs, each { program, number }.",
          items: {
            type: "object",
            properties: {
              program: { type: "string", description: "Program name (e.g. 'United MileagePlus')." },
              number: { type: "string", description: "Membership number." },
            },
          },
        },
        knownTravelerNumber: { type: "string", description: "Known Traveler Number (TSA PreCheck). Send only a new value." },
        passportNumber: { type: "string", description: "Passport number. Send only a new value." },
        passportExpiry: { type: "string", description: "Passport expiry (YYYY-MM-DD)." },
        seatPreference: { type: "string", description: "window, aisle, or no_preference." },
        cabinPreference: { type: "string", description: "ECON, PREM_ECON, BIZ, or FIRST." },
      },
      required: [] as string[],
    },
  },
  ...ACTION_TOOL_DEFINITIONS,
]

/**
 * Tools safe to expose on the internet-facing MCP server: non-mutating,
 * non-expensive reads only. No create_/update_/delete_/set_/exclude_/mark_
 * writes, no live searches (provider spend), no refresh triggers. The MCP
 * server both advertises and dispatches strictly from this set.
 */
export const READ_ONLY_TOOL_NAMES: ReadonlySet<string> = new Set([
  "get_account_balances",
  "get_spending_summary",
  "get_transactions",
  "get_budget_status",
  "get_subscriptions",
  "get_net_worth",
  "get_investments",
  "get_credit_cards",
  "get_flight_search_summary",
  "get_flight_results",
  "analyze_fare_details",
  "list_trips",
  "get_trip_briefing",
  "get_trip_expenses",
  "list_saved_routes",
  "get_points_balances",
  "get_traveler_profile",
  "get_portfolio_balances",
  "get_staking_positions",
  "get_wallet_pnl",
  "get_portfolio_history",
])
