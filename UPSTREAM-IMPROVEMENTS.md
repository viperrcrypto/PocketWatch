# PocketWatch — Upstream Improvements List

All improvements made to viperr's original PocketWatch codebase, organized as potential upstream PR contributions.

**Baseline:** commit `d361fa5` (Initial release)
**Current:** commit `543ce90` (4 commits, 6,437 lines added, 146 removed across 78 files)

---

## PR 1: Fix Bill Calendar UTC Date Shift Bug

**Type:** Bug Fix
**Files:** `src/components/finance/bills-calendar-helpers.ts`

`new Date("2026-03-22")` parses as UTC midnight. In PDT (-7), this shifts back to March 21 local time, causing bills to appear on the wrong calendar day. Fixed by parsing as local time: `new Date(y, m - 1, d)`.

Also fixes projected bills incorrectly showing as "paid" — when a bill is projected forward to a future month, `isPaid` is now reset to `false` since the future occurrence hasn't been paid yet.

---

## PR 2: Fix CC Bill Projections (Wrong Day, Wrong Amount, Wrong Name)

**Type:** Bug Fix
**Files:** `src/lib/finance/bill-projections.ts`, `prisma/schema.prisma`

- Non-Plaid CC bills were hardcoded to the 25th of every month. Now uses `CreditCardProfile.paymentDueDay` (new `Int?` schema field, falls back to 25).
- Amount showed a synthetic minimum payment (`max(25, balance * 2%)`). Now shows full balance, which is more useful for planning.
- Display name used the generic account name ("Citi Checking"). Now uses `cardName` from the card profile ("Citi Strata Premier").
- Date string constructed directly as `YYYY-MM-DD` instead of going through `toISOString()`, avoiding potential UTC shift.

---

## PR 3: Fix Card-Account Matching When SimpleFIN Misclassifies Types

**Type:** Bug Fix
**Files:** `src/app/(dashboard)/finance/cards/page.tsx`, `src/lib/finance/bill-projections.ts`

SimpleFIN often classifies credit cards as "checking." Two fixes:

1. **Cards page:** Card profiles are now matched against all accounts by ID (not just `type === "credit"`). Header totals include accounts that have a linked card profile regardless of type.
2. **CC bill projections:** Source 2 (non-Plaid) now queries `CreditCardProfile` directly instead of filtering by account type. Uses a `source1AccountIds` set to prevent duplicates with Plaid liabilities.

---

## PR 4: Fix CoinGecko Demo Key Verification

**Type:** Bug Fix
**Files:** `src/lib/portfolio/service-key-verifier.ts`

Free-tier CoinGecko keys use `api.coingecko.com` with `x-cg-demo-api-key` header, not the pro endpoint. Verification now tries both endpoints in sequence. Also fixes the Moralis verification endpoint (changed to `/api/v2.2/web3/version`).

---

## PR 5: SimpleFIN Sync Improvements (Throttling + Credit Card Auto-Detection)

**Type:** Bug Fix + Enhancement
**Files:** `src/lib/finance/sync/simplefin-sync.ts`

1. **2-hour sync throttle:** SimpleFIN has a 24-request/day limit and refreshes at most once daily. Enforces a 2-hour minimum interval between syncs (max 12/day), returning early with a skip message if too soon.
2. **Auto-detect misclassified credit cards:** 20 regex patterns (sapphire, platinum, freedom, discover, bilt, apple card, etc.) identify credit cards regardless of SimpleFIN's `type` field. Auto-corrects the account type to `"credit"` and creates a `CreditCardProfile`.
3. **Mastercard detection fix:** Card network detection now also checks the account name (not just institution name) for "mastercard."

---

## PR 6: Account Type Reclassification

**Type:** New Feature
**Files:** `src/app/api/finance/accounts/route.ts`, `src/components/finance/account-type-selector.tsx` (new), `src/components/finance/accounts/institution-accordion.tsx`, `src/hooks/finance/use-accounts.ts`, `src/app/(dashboard)/finance/accounts/page.tsx`

PATCH `/api/finance/accounts` now accepts a `type` field (validated: checking, savings, credit, business_credit, investment, loan, mortgage). Reclassifying to credit auto-creates a `CreditCardProfile`; reclassifying away from credit removes it. New inline `AccountTypeSelector` dropdown component in the accounts list.

---

## PR 7: Bill Detail Side Panel

**Type:** New Feature
**Files:** `src/components/finance/bill-detail-panel.tsx` (new), `src/components/finance/cards-bills-section.tsx`, `src/components/finance/bills-calendar.tsx`

Slide-in panel when clicking a bill anywhere in the UI. Shows merchant avatar, bill type badge, amount, linked account info (institution, account name, mask), schedule (frequency, next due, paid status), category, and "Cancel Subscription" link for non-CC bills. Bills calendar supports month navigation that fetches correct bills for non-current months.

---

## PR 8: Bill Account Metadata

**Type:** Enhancement
**Files:** `src/lib/finance/bill-helpers.ts`, `src/lib/finance/bill-projections.ts`, `src/app/api/finance/bills/route.ts`, `src/components/finance/bills-calendar.tsx`, `src/components/finance/cards-bills-section.tsx`

`BillItem` now carries `accountName`, `accountMask`, and `institutionName` through all projection functions and into the UI. Bills API query now includes account `name` field.

---

## PR 9: Card Perks Checklist Component

**Type:** Enhancement / Refactor
**Files:** `src/components/finance/card-perks-checklist.tsx` (new), `src/components/finance/perks-tracker.tsx`, `src/app/(dashboard)/finance/cards/[id]/page.tsx`

New reusable `CardPerksChecklist` with checkbox UI showing perk name, value, used/unused state, and ROI % against annual fee. Replaces ~50 lines of inline rendering in the perks tracker. Card detail page now shows a "Card Perks" section using the same component.

---

## PR 10: Expanded Card Image Map

**Type:** Enhancement
**Files:** `src/components/finance/card-image-map.ts`

- Fixed Amex Platinum keywords from `["platinum", "card"]` to `["amex", "platinum"]` (was matching non-Amex cards)
- Added: Citi AAdvantage Platinum, Apple Card, Bilt
- Added duplicate Citi Strata Premier entry with better keywords

---

## PR 11: API Key Authentication for Remote Access

**Type:** New Feature
**Files:** `src/lib/auth.ts`, `.env.example`

New `POCKETWATCH_API_KEY` env var enables programmatic access via `Authorization: Bearer <key>` header. Uses `crypto.timingSafeEqual` for constant-time comparison. Falls back to borrowing the most recent active session for encryption key access. Enables tools like OpenClaw to access PocketWatch APIs.

---

## PR 12: Database Auto-Backup Before Migrations

**Type:** Enhancement
**Files:** `package.json`

New `db:backup` script runs `pg_dump` to timestamped file in `backups/`. The `db:prepare` script calls it before `prisma migrate deploy` (suppresses errors if pg_dump unavailable). Prevents data loss from bad migrations.

---

## PR 13: Dev Server LAN Access

**Type:** Enhancement
**Files:** `package.json`

Changed `next dev --port 3000` to `next dev --hostname 0.0.0.0 --port 3000` so the dev server is accessible from phones/tablets on the local network.

---

## PR 14: SOCKS5 Proxy Support for Crypto Exchanges

**Type:** New Feature
**Files:** `package.json` (socks-proxy-agent dep), `src/lib/portfolio/exchange-types.ts`

If `EXCHANGE_PROXY` env var is set, CCXT exchange configs receive a `socksProxy` option, routing exchange API traffic through the proxy. Enables users in geo-blocked regions to sync exchange portfolios.

---

## PR 15: Travel Module — Multi-Source Flight & Hotel Search

**Type:** Major New Feature (43 new files, ~5,000 lines)
**Files:** Entire `src/lib/travel/`, `src/components/travel/`, `src/hooks/travel/`, `src/app/api/travel/`, `src/app/(dashboard)/travel/`, `src/types/travel.ts`

Complete travel search module:

### Flights
- **Roame** integration (award miles search via GraphQL API + static data fallback)
- **SerpAPI/Google Flights** integration (cash prices, schedules, airlines)
- **ATF** integration (19+ airlines via REST API for award availability)
- Parallel search orchestration with cross-referencing between sources
- Value scoring engine with cents-per-point calculations
- Transfer partner recommendations (which credit card points to use)
- Sweet spot detection for outsized award value
- Stops filter, cabin filter, pricing type filter (cash/points/all)
- Recent searches with localStorage persistence and auto-execute

### Hotels
- **SerpAPI Google Hotels** (cash prices, reviews, ratings, amenities, booking links)
- **Roame** hotel data (12,858 hotels with brand/points data, plus live GraphQL for real-time pricing)
- **ATF** hotel brand/availability enrichment
- Hotel orchestrator merges all sources into unified results
- Points-per-night pricing alongside cash rates

### Infrastructure
- Credential management UI (encrypted storage via FinanceCredential model)
- Loyalty balance display (Roame wallet data)
- Roame JWT auto-refresh via Firebase token exchange
- 5-minute in-memory response cache for both flight and hotel searches
- Real-time Roame GraphQL integration with automatic fallback to static data

---

## Summary

| # | Title | Type | Impact |
|---|-------|------|--------|
| 1 | Fix bill calendar UTC date shift | Bug Fix | Bills on wrong day in western timezones |
| 2 | Fix CC bill projections | Bug Fix | Wrong day, amount, and name for CC bills |
| 3 | Fix card-account mismatching | Bug Fix | Missing card data for misclassified accounts |
| 4 | Fix CoinGecko demo key verification | Bug Fix | Demo keys always failed verification |
| 5 | SimpleFIN sync improvements | Bug Fix + Enhancement | Rate limiting + auto-detect credit cards |
| 6 | Account type reclassification | New Feature | Users can fix misclassified account types |
| 7 | Bill detail side panel | New Feature | Click any bill to see details |
| 8 | Bill account metadata | Enhancement | Bills show which account they charge |
| 9 | Card perks checklist | Enhancement | Unified perks UI with ROI tracking |
| 10 | Expanded card image map | Enhancement | More card art, fixed false matches |
| 11 | API key auth for remote access | New Feature | Programmatic API access |
| 12 | DB auto-backup before migrations | Enhancement | Prevents data loss |
| 13 | Dev server LAN access | Enhancement | Access from mobile devices |
| 14 | SOCKS5 proxy for exchanges | New Feature | Geo-blocked exchange sync |
| 15 | Travel module | Major Feature | Full flight + hotel search system |
