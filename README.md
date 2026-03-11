<p align="center">
  <img src="public/img/logo-circle.png" width="100" height="100" alt="PocketWatch" />
</p>

<h1 align="center">PocketWatch</h1>

<p align="center">
  <strong>See everything you own. In one place.</strong><br/>
  Self-hosted wealth tracker. Bank accounts, investments, credit cards, digital assets — unified.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

<p align="center">
  <a href="#-what-it-tracks">What It Tracks</a> &nbsp;&bull;&nbsp;
  <a href="#-how-it-works">How It Works</a> &nbsp;&bull;&nbsp;
  <a href="#-getting-started">Getting Started</a> &nbsp;&bull;&nbsp;
  <a href="#-environment-variables">Environment Variables</a> &nbsp;&bull;&nbsp;
  <a href="#-project-structure">Project Structure</a> &nbsp;&bull;&nbsp;
  <a href="#-security">Security</a> &nbsp;&bull;&nbsp;
  <a href="#-contributing">Contributing</a>
</p>

---

## Why PocketWatch?

Your financial life is scattered across bank apps, brokerage accounts, credit card portals, and maybe a spreadsheet or two. PocketWatch pulls it all into a single dashboard that **you own and control** — running on your own server, encrypted with a password only you know.

```
        YOUR MONEY                                YOUR CRYPTO
  ──────────────────────                    ──────────────────────
  Chase  ·  BofA  ·  Wells                 ETH  ·  SOL  ·  BTC
  Fidelity  ·  Schwab  ·  Vanguard         Arbitrum  ·  Base  ·  20+ chains
  Amex  ·  Citi  ·  Discover               Binance  ·  Coinbase  ·  40+ CEXs
          │                                          │
          │         Plaid · SimpleFIN                │        Zerion · Alchemy · CCXT
          │                                          │
          ▼                                          ▼
  ┌──────────────────────────────────────────────────────────────┐
  │                                                              │
  │                     ⚙  PocketWatch                           │
  │                                                              │
  │   Balances     Transactions     Budgets      Net Worth       │
  │   Staking      NFTs             PnL          Insights        │
  │   Cards        Subscriptions    Investments   History        │
  │                                                              │
  │          Encrypted  ·  Self-hosted  ·  Single-user           │
  └──────────────────────────────────────────────────────────────┘
```

No cloud. No subscriptions. No one else sees your data.

---

## What It Tracks

### Banking & Spending

| Feature | Description |
|---------|-------------|
| **Bank account sync** | Connect checking, savings, and money market accounts via Plaid or SimpleFIN |
| **Budget management** | Set spending budgets by category with visual progress bars |
| **Transaction categorization** | Auto-categorize transactions with AI assistance and custom rules |
| **Subscription detection** | Automatically find recurring charges, track renewals, get cancel guidance |
| **Spending insights** | Trends, forecasts, category breakdowns, and financial health scoring |

### Investments & Net Worth

| Feature | Description |
|---------|-------------|
| **Investment accounts** | Brokerage holdings synced through Plaid (Fidelity, Schwab, Vanguard, etc.) |
| **Credit card tracking** | Cards, balances, rewards points, and spending by issuer |
| **Net worth snapshots** | Historical net worth chart combining all account types |
| **Spending vs. income** | Recurring income and expense stream detection |

### Digital Assets

| Feature | Description |
|---------|-------------|
| **Multi-chain wallets** | Track balances across 20+ blockchains (Ethereum, Solana, Base, Arbitrum, and more) |
| **Exchange accounts** | Connect Binance, Coinbase, Kraken, OKX, and 40+ exchanges |
| **Transaction history** | Full history with spam filtering, classification, and cost-basis tracking |
| **Staking** | Monitor staking positions, rewards, and APY tracking |
| **NFTs** | View your collection with metadata |
| **PnL & tax prep** | Lot-based cost tracking with realized gains |

### Platform

| Feature | Description |
|---------|-------------|
| **Encrypted vault** | Single-user, password-derived AES-256-GCM encryption for all stored credentials |
| **Dark / light mode** | System-aware with manual toggle |
| **PWA installable** | Add to home screen on mobile, use like a native app |
| **Customizable sidebar** | Drag, reorder, and hide navigation items to match your workflow |
| **Mobile responsive** | Full mobile support with bottom tab navigation |
| **Background sync** | Automated balance refresh, staking snapshots, and transaction sync |

---

## How It Works

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser / PWA                                                      │
│  React 19 · Tailwind 4 · Recharts · TanStack Query                 │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Next.js 16 API Layer                                               │
│                                                                     │
│  /api/finance/*  ──── Bank sync, budgets, cards, transactions       │
│  /api/portfolio/* ─── Wallets, balances, history, staking, NFTs     │
│  /api/auth/*  ─────── Vault setup, unlock, lock, reset              │
│  /api/internal/* ──── Background workers (cron-triggered)           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              ▼                 ▼                  ▼
   ┌────────────────┐  ┌──────────────┐  ┌──────────────────┐
   │   Banking       │  │  Market Data │  │  Blockchain       │
   │                 │  │              │  │                   │
   │  Plaid          │  │  CoinGecko   │  │  Zerion           │
   │  SimpleFIN      │  │  DefiLlama   │  │  Alchemy          │
   │                 │  │              │  │  Etherscan         │
   │                 │  │              │  │  CCXT (40+ CEXs)  │
   └────────┬────────┘  └──────┬───────┘  └────────┬──────────┘
            │                  │                    │
            └──────────────────┼────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PostgreSQL · Prisma ORM · 40+ models                               │
│                                                                     │
│  Accounts · Transactions · Snapshots · Budgets · Subscriptions      │
│  Wallets · Balances · Staking · Cards · Investments · NFTs          │
│                                                                     │
│  All credentials encrypted with AES-256-GCM                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Tech Stack

```
Layer             Technology                       Purpose
────────────────  ───────────────────────────────  ────────────────────────────
Frontend          Next.js 16, React 19             App framework
Styling           Tailwind CSS 4, Material Symbols Theme & icons
Charts            Recharts, Lightweight Charts     Visualizations
State             TanStack Query (React Query)     Data fetching & caching
Database          PostgreSQL + Prisma ORM 7        Persistence (40+ models)
Auth              bcrypt + AES-256-GCM             Vault encryption
Banking           Plaid SDK, SimpleFIN             Bank account sync
Blockchain        wagmi v2, viem, Reown AppKit     Wallet connection
Exchanges         CCXT                             40+ exchange connectors
Prices            CoinGecko, DefiLlama             Market data
```

### Vault Model

PocketWatch is a **single-user vault**. No user accounts, no sign-ups. One password, one owner.

```
  First visit                         Return visit
  ───────────                         ────────────

  Set password (min 8 chars)          Enter password
        │                                   │
        ▼                                   ▼
  PBKDF2 ──▶ Encryption Key          Derive key ──▶ Decrypt vault
        │                                   │
        ▼                                   ▼
  Create encrypted vault              Load dashboard
  Set session cookie                  Set session cookie
        │                                   │
        ▼                                   ▼
  ┌──────────────────┐                ┌──────────────────┐
  │    Dashboard      │                │    Dashboard      │
  └──────────────────┘                └──────────────────┘

  Session: httpOnly · secure · sameSite=strict · 7-day expiry

  ⚠ Forget the password → data is unrecoverable. Vault can only be wiped.
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ (20+ recommended) |
| PostgreSQL | 14+ (local, Supabase, Neon, Railway) |
| npm | comes with Node.js |

### 1. Clone and install

```bash
git clone https://github.com/viperrcrypto/PocketWatch.git
cd PocketWatch
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Generate an encryption key:

```bash
openssl rand -hex 32
```

Minimum `.env`:

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/pocketwatch"
DATABASE_URL_UNPOOLED="postgresql://user:pass@localhost:5432/pocketwatch"
ENCRYPTION_KEY="<paste-your-64-char-hex-string>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Set up the database

```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Start

```bash
npm run dev
```

Open **http://localhost:3000** and set your vault password. That's it.

### Production

```bash
npm run build
npm start
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | PostgreSQL direct connection (for migrations) |
| `ENCRYPTION_KEY` | 32-byte hex — `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL |

### Data Providers

Each provider unlocks a set of features. Add them as needed:

| Variable | Unlocks | Where to get it |
|----------|---------|-----------------|
| `ZERION_API_KEY` | Multi-chain wallet balances | [zerion.io/developers](https://zerion.io/developers) |
| `COINGECKO_API_KEY` | Token prices & market data | [coingecko.com/en/api](https://www.coingecko.com/en/api) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | EVM RPC, tx history, NFTs | [alchemy.com](https://www.alchemy.com/) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Browser wallet connection | [cloud.walletconnect.com](https://cloud.walletconnect.com) |

> Plaid and SimpleFIN credentials are configured through the in-app settings UI.

### Background Sync

For automatic data refresh, set secrets for the cron worker endpoints:

| Variable | Endpoint |
|----------|----------|
| `STAKING_CRON_SECRET` | `/api/internal/staking/snapshot-hourly` |
| `HISTORY_CRON_SECRET` | `/api/internal/history/sync-worker` |
| `PORTFOLIO_REFRESH_CRON_SECRET` | `/api/internal/portfolio/refresh-worker` |
| `SNAPSHOT_WORKER_SECRET` | `/api/internal/snapshot-worker` |

Generate each: `openssl rand -hex 16`

### Rate Limit Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `PORTFOLIO_REFRESH_TTL_MS` | `300000` | 5 min cooldown between refreshes |
| `ZERION_MIN_INTERVAL_MS` | `20000` | 20s between Zerion calls |
| `ALCHEMY_MIN_INTERVAL_MS` | `500` | 500ms between Alchemy calls |
| `CCXT_MIN_INTERVAL_MS` | `15000` | 15s between exchange calls |
| `DEFI_LLAMA_MIN_INTERVAL_MS` | `1000` | 1s between DefiLlama calls |

---

## Project Structure

```
PocketWatch/
├── prisma/
│   └── schema.prisma               # Database schema (40+ models)
├── public/img/                      # Logos, PWA icons, OG images
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── finance/             # Banking, budgets, cards, investments
│   │   │   │   ├── page.tsx         #   Finance dashboard
│   │   │   │   ├── accounts/        #   Bank accounts (Plaid/SimpleFIN)
│   │   │   │   ├── budgets/         #   Budgets & subscription management
│   │   │   │   ├── cards/           #   Credit card tracking
│   │   │   │   ├── categorize/      #   Transaction categorization
│   │   │   │   ├── investments/     #   Brokerage holdings
│   │   │   │   └── transactions/    #   Transaction list & search
│   │   │   └── portfolio/           # Digital assets
│   │   │       ├── page.tsx         #   Portfolio overview
│   │   │       ├── accounts/        #   Wallet & exchange management
│   │   │       ├── balances/        #   On-chain, exchange, manual
│   │   │       ├── history/         #   Transactions, PnL, snapshots
│   │   │       ├── staking/         #   Staking positions & APY
│   │   │       └── nfts/            #   NFT gallery
│   │   └── api/
│   │       ├── auth/                #   Vault auth (setup/unlock/lock/reset)
│   │       ├── finance/             #   Banking data endpoints
│   │       ├── portfolio/           #   Digital asset endpoints
│   │       └── internal/            #   Background sync workers
│   ├── components/
│   │   ├── finance/                 # Banking UI (budgets, cards, insights)
│   │   ├── portfolio/               # Digital asset UI (balances, history)
│   │   ├── layout/                  # Sidebar, header, mobile nav
│   │   └── ui/                      # Shared primitives
│   ├── hooks/
│   │   ├── finance/                 # Banking hooks (one per domain)
│   │   └── portfolio/               # Portfolio hooks (one per domain)
│   ├── lib/
│   │   ├── finance/                 # Plaid sync, categorization, analytics
│   │   ├── portfolio/               # Wallet sync, staking, cost-basis, tx
│   │   └── defillama/               # Protocol data
│   └── types/                       # Shared TypeScript interfaces
├── .env.example
├── next.config.ts                   # Next.js config + security headers
└── package.json
```

---

## Data Providers

PocketWatch connects to multiple data sources. All credentials are encrypted at rest with AES-256-GCM.

### Banking & Brokerage

| Provider | What it does | Key needed? |
|----------|-------------|-------------|
| **Plaid** | Bank accounts, transactions, credit cards, investment holdings | Yes (configured in-app) |
| **SimpleFIN** | Alternative bank sync (community-driven) | Yes (configured in-app) |

### Market Data

| Provider | What it does | Key needed? |
|----------|-------------|-------------|
| **CoinGecko** | Token prices, market data, historical prices | Yes (free tier) |
| **DefiLlama** | Protocol TVL, yields, DeFi token prices | No (fully free) |

### Blockchain & Exchanges

| Provider | What it does | Key needed? |
|----------|-------------|-------------|
| **Zerion** | Multi-chain wallet balance aggregation | Yes (free tier) |
| **Alchemy** | EVM transaction history, NFT metadata, RPC | Yes (free tier) |
| **Etherscan** | EVM transaction scanning (+ Arbiscan, Basescan, etc.) | Optional |
| **CCXT** | Centralized exchange balances & history (40+ exchanges) | Exchange API keys |
| **WalletConnect / Reown** | Browser wallet connection | Optional |

---

## Database

**PostgreSQL** with **Prisma ORM**. 40+ models covering:

```
Banking & Spending            Investments & Net Worth       Digital Assets
──────────────────            ──────────────────────        ──────────────
FinanceCredential             FinanceInvestmentHolding      TrackedWallet
FinanceInstitution            FinanceInvestmentSecurity     PortfolioSnapshot
FinanceBudget                 FinanceInvestmentTransaction  TransactionCache
FinanceSubscription           CreditCardProfile             StakingSnapshot
FinanceCategoryRule           FinanceRecurringStream        StakingPosition
FinanceSnapshot               PortfolioSnapshot             CostBasisLot
PlaidDataSnapshot             ChartCache                    RealizedGain

Auth & System
──────────────
User · Session (encrypted DEK) · ExternalApiKey · ProviderCallGate
```

### Design decisions

- **Encrypted credentials** — AES-256-GCM with per-user DEK wrapped by master key
- **Snapshot history** — Balances captured periodically for historical net worth charts
- **Incremental sync** — Dedicated sync state tables per provider to avoid redundant API calls
- **Provider rate limiting** — `ProviderCallGate` model prevents API bans

---

## Security

### What's encrypted

```
Vault Password
      │
      ├──▶ bcrypt (cost 12)  ──────▶  Stored hash (auth verification)
      │
      └──▶ PBKDF2 derivation ──────▶  Data Encryption Key (DEK)
                                             │
                                             ▼
                                       AES-256-GCM encrypts:
                                         • Bank tokens (Plaid)
                                         • Brokerage credentials
                                         • Exchange API keys
                                         • Blockchain provider keys
```

### Security headers

| Header | Value |
|--------|-------|
| Content-Security-Policy | Restrictive with enumerated sources |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Strict-Transport-Security | 2 years, includeSubDomains, preload |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | Camera, microphone, geolocation disabled |

### Session

| Property | Value |
|----------|-------|
| Cookie flags | `httpOnly`, `secure`, `sameSite=strict` |
| Duration | 7 days |
| Rate limiting | Per-IP, per-endpoint |

### Deployment checklist

- [ ] HTTPS in production (reverse proxy with TLS)
- [ ] Set real cron secrets: `openssl rand -hex 16`
- [ ] Restrict network access (firewall / Cloudflare Access / VPN)
- [ ] Back up `ENCRYPTION_KEY` — lose it and encrypted data is gone forever
- [ ] Regular `pg_dump` backups
- [ ] `npm audit` periodically

---

## Deployment

Works with any platform that supports Node.js + PostgreSQL.

### Railway / Render / Fly.io

1. Connect your GitHub repo
2. Set environment variables in the platform dashboard
3. Build: `npm run build` &nbsp;|&nbsp; Start: `npm start`
4. Add PostgreSQL and set `DATABASE_URL` + `DATABASE_URL_UNPOOLED`

### Background Sync

Set up cron jobs for automatic data refresh:

```bash
# Every 15 min — refresh balances
curl -X POST https://your-app.com/api/internal/portfolio/refresh-worker \
  -H "Authorization: Bearer $PORTFOLIO_REFRESH_CRON_SECRET"

# Every hour — staking snapshot
curl -X POST https://your-app.com/api/internal/staking/snapshot-hourly \
  -H "x-staking-cron-secret: $STAKING_CRON_SECRET"

# Every 6 hours — transaction history
curl -X POST https://your-app.com/api/internal/history/sync-worker \
  -H "x-history-cron-secret: $HISTORY_CRON_SECRET"
```

---

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Production server |
| `npm run lint` | ESLint |
| `npm run db:prepare` | Prisma generate + migrate |

### Code conventions

| Rule | Limit |
|------|-------|
| Pages | Max 400 lines |
| Components | Max 300 lines, one per file |
| API routes | Max 200 lines |
| Hooks | React Query with query key factories |
| Styling | Tailwind + CSS variables |
| Icons | Material Symbols Rounded |
| Toasts | sonner |

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow the code conventions
4. Verify: `npm run build`
5. Open a pull request

---

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built for people who want to see their full financial picture without trusting a third party.</sub>
</p>
