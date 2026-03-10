# WealthTracker — Project Rules

## HARD RULES (never break these)

### File Size Limits
- **Pages**: MAX 400 lines. Extract sections into components.
- **Components**: MAX 300 lines. Split into sub-components.
- **Hooks**: MAX 300 lines per file. Group by feature domain (e.g. `use-finance-budgets.ts`, not one giant `use-finance.ts`).
- **Library files**: MAX 400 lines. Split by concern.
- **API routes**: MAX 200 lines. Extract shared logic to lib/.
- If a file exceeds these limits, SPLIT IT before adding more code.
- NEVER create a "god file" that holds all hooks/components for a module.
- Before adding code to ANY file, check its line count. If adding your code would exceed the limit, split first.

### File Organization
- One hook file per feature domain: `use-portfolio-balances.ts`, `use-portfolio-sync.ts`, etc.
- One component per file. If a page needs 5 sections, that's 5 component files + 1 page file.
- Shared types go in `src/types/`. Shared utils go in `src/lib/`.
- Group by feature, not by type: `portfolio/settings/api-keys-section.tsx`, not `components/sections/api-keys.tsx`.
- Constants, helpers, and types shared across components in a feature go in a `-constants.ts`, `-helpers.ts`, or `-types.ts` file alongside the components.
- Barrel re-exports (`index.ts`) for hook directories only. Components import directly.

### Before Writing Code
- Read the files you'll modify FIRST. Don't guess structure.
- Check existing patterns in the codebase before inventing new ones.
- If you need to add >50 lines to a file, check its current size first. Split if needed.
- Search for existing utilities before writing new ones (`src/lib/`, `src/hooks/`).
- Never duplicate logic — if two components need the same helper, extract it.

### Code Quality
- Immutable data patterns only — NEVER mutate. Return new objects.
- All API routes use `apiError()` from `@/lib/api-error` for error responses.
- All hooks use React Query with the query key factory pattern (see existing hooks).
- TypeScript strict mode — no `any` unless absolutely necessary with a comment explaining why.
- No hardcoded values — use constants or config.
- Functions should be <50 lines. If longer, extract helpers.
- No deep nesting (>4 levels). Use early returns and guard clauses.
- Prefer named exports over default exports (except page.tsx which Next.js requires as default).

### Auth Pattern
- All API routes: `const user = await getCurrentUser(); if (!user) return apiError(..., 401)`
- Use `requireAuth()` or `withAuthEncryption()` from `@/lib/auth`.

### Error Handling
- API routes: always wrap in try/catch, return `apiError()` with unique error code.
- Hooks: let React Query handle errors. Use `onError` callbacks for user-facing toasts.
- Components: use error boundaries for crash recovery, inline error states for data failures.
- NEVER silently swallow errors. Log server-side, toast client-side.

### Performance
- Lazy-load heavy components with `dynamic()` (charts, editors, modals).
- Use `useMemo`/`useCallback` for expensive computations and stable references passed to children.
- Paginate all list endpoints — never return unbounded arrays.
- Use cursor-based pagination for feeds/transactions, offset-based for finite lists.
- Prisma: always `select` or `include` only needed fields. Never `findMany()` without limits.

### Security
- Never expose raw database errors to the client.
- Never store plaintext API keys — use `apiKeyEnc` with server-side encryption.
- Validate all request body fields before database operations.
- Never trust client-side data for authorization — always verify server-side.

### Naming Conventions
- Components: PascalCase (`TransactionFeed.tsx` → `transaction-feed.tsx` file)
- Hooks: `use-{feature}-{domain}.ts` (e.g. `use-portfolio-sync.ts`)
- Lib files: kebab-case (`token-prices.ts`, `pnl-calculator.ts`)
- API routes: kebab-case directories matching the resource (`/api/tracker/api-keys/`)
- Types: PascalCase interfaces, camelCase properties
- Constants: UPPER_SNAKE_CASE for true constants, camelCase for config objects

### What NOT to Do
- Don't add features beyond what was asked — no speculative abstractions.
- Don't add comments to code you didn't write or change.
- Don't create wrapper components for single-use cases.
- Don't add error handling for impossible scenarios.
- Don't refactor surrounding code when fixing a bug — fix the bug only.
- Don't import from barrel files when you can import directly from the source.

## Stack
- **Framework**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **State**: React Query (@tanstack/react-query)
- **Styling**: Tailwind v4, CSS variables for colors (`var(--foreground)`, `var(--card-border)`, etc.)
- **UI**: Material Symbols icons, custom card/button classes (`card`, `btn-primary`, `btn-secondary`, `btn-ghost`)
- **Auth**: Session cookies + bcrypt (local auth, no third-party OAuth)
- **Encryption**: Per-user AES key wrapped with server master key
- **Toasts**: sonner (`toast.success()`, `toast.error()`)
- **Charts**: lightweight-charts (lazy-loaded)

## Project Structure
```
src/
  app/
    (dashboard)/          # Authenticated pages with sidebar layout
      portfolio/          # Crypto portfolio tracking (Zerion, on-chain)
        settings/         # API keys, exchanges, sync controls, diagnostics
        history/          # Transaction history with spam filtering
        accounts/         # Wallet & exchange account management
      tracker/            # Wallet tracker (scan, feed, PnL)
      finance/            # Fiat finance (Plaid, budgets, cards)
    api/
      portfolio/          # Portfolio API routes
      tracker/            # Tracker API routes (wallet scan, feed, analytics)
      finance/            # Finance API routes
      auth/               # Auth routes (login, register, me, logout)
      internal/           # Background job orchestration
  components/
    portfolio/            # Portfolio UI components
      settings/           # Settings page sections (api-keys, exchanges, sync, diagnostics)
      history/            # History page sections (filters, table, spam detection)
      accounts/           # Account page sections (wallet cards, add dialog, exchange cards)
    tracker/              # Tracker UI components (feed, wallets, analytics)
    finance/              # Finance UI components
    layout/               # Sidebar, header, mobile nav
    ui/                   # Shared UI primitives
  hooks/
    portfolio/            # Portfolio hooks split by domain (shared, overview, sync, etc.)
    finance/              # Finance hooks split by domain (accounts, budgets, etc.)
  lib/
    portfolio/            # Portfolio business logic (chains, exchanges, utils, verification)
    tracker/              # Tracker lib (scanner/*, PnL, enricher, chains, types)
      scanner/            # One file per provider (evm-etherscan, solana-helius, etc.)
    finance/              # Finance business logic (sync, categorization)
  types/                  # Shared TypeScript types
  generated/              # Prisma client (auto-generated, don't edit)
```

## Data Pipeline
- **Zerion**: balances, positions, chart, staking, rewards
- **Alchemy**: EVM tx history (8-phase sync)
- **Helius**: Solana tx history
- **Etherscan-family**: EVM tx scanning (tracker module)
- **Codex**: unified chain data (when key available)
- **Plaid/SimpleFIN**: bank account sync (finance module)
- All data stored in PostgreSQL; all pages read from DB.

## Key Patterns

### Hook Pattern
```typescript
// hooks/portfolio/shared.ts — query key factory
export const portfolioKeys = {
  all: ["portfolio"] as const,
  overview: () => [...portfolioKeys.all, "overview"] as const,
  balances: (chain?: string) => [...portfolioKeys.all, "balances", chain] as const,
}

// hooks/portfolio/use-overview.ts — one hook per file
export function usePortfolioOverview() {
  return useQuery({
    queryKey: portfolioKeys.overview(),
    queryFn: () => portfolioFetch("/overview"),
  })
}
```

### API Route Pattern
```typescript
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("P1001", "Authentication required", 401)
  try {
    const data = await db.thing.findMany({ where: { userId: user.id }, select: { ... } })
    return NextResponse.json({ data })
  } catch (error) {
    return apiError("P1002", "Failed to load data", 500, error)
  }
}
```

### Component Composition Pattern
```typescript
// Page file — thin orchestrator, <400 lines
export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <ApiKeysSection />
      <ExchangeSection />
      <SyncControlsSection />
      <DiagnosticsSection />
    </div>
  )
}
```

### Fetch Helpers
- `portfolioFetch()`, `trackerFetch()`, `financeFetch()` — one per module.
- All handle auth errors and JSON parsing consistently.

### Scanner Module
- Separate files per provider: `scanner/evm-etherscan.ts`, `scanner/solana-helius.ts`, `scanner/codex.ts`, etc.
- Barrel re-export from `scanner/index.ts`.
