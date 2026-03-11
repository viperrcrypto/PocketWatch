<p align="center">
  <img src="public/img/logo-circle.png" width="100" height="100" alt="PocketWatch" />
</p>

<h1 align="center">PocketWatch</h1>

<p align="center">
  <strong>Your personal finance and digital asset command center.</strong><br/>
  Self-hosted. Single-user vault. Everything encrypted at rest.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss" alt="Tailwind 4" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma" alt="Prisma 7" />
  <img src="https://img.shields.io/badge/PostgreSQL-14+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" />
</p>

<p align="center">
  <a href="#-features">Features</a> &nbsp;&bull;&nbsp;
  <a href="#-architecture">Architecture</a> &nbsp;&bull;&nbsp;
  <a href="#-getting-started">Getting Started</a> &nbsp;&bull;&nbsp;
  <a href="#-environment-variables">Environment Variables</a> &nbsp;&bull;&nbsp;
  <a href="#-project-structure">Project Structure</a> &nbsp;&bull;&nbsp;
  <a href="#-security">Security</a> &nbsp;&bull;&nbsp;
  <a href="#-contributing">Contributing</a>
</p>

---

## What is PocketWatch?

PocketWatch is a **self-hosted personal finance dashboard** that brings your crypto portfolio, bank accounts, credit cards, investments, and DeFi positions together in one place. It runs entirely on your own infrastructure with a single-user encrypted vault — no cloud accounts, no third-party data access, no tracking.

> **Think of it as your own private Bloomberg terminal for personal finance.**

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│   │  Portfolio   │    │   Finance   │    │  Settings   │        │
│   │             │    │             │    │             │        │
│   │  Balances   │    │  Accounts   │    │  API Keys   │        │
│   │  History    │    │  Budgets    │    │  Exchanges  │        │
│   │  Staking    │    │  Cards      │    │  Sync       │        │
│   │  DeFi       │    │  Investments│    │  Diagnostics│        │
│   │  NFTs       │    │  Categories │    │             │        │
│   │  Airdrops   │    │  Transactions│   │             │        │
│   └──────┬──────┘    └──────┬──────┘    └─────────────┘        │
│          │                  │                                   │
│          ▼                  ▼                                   │
│   ┌─────────────────────────────────────────────────────┐      │
│   │               Data Provider Layer                    │      │
│   │                                                      │      │
│   │  Zerion    Alchemy    CoinGecko    Plaid             │      │
│   │  CCXT      DefiLlama  Etherscan    SimpleFIN         │      │
│   └──────────────────────┬───────────────────────────────┘      │
│                          │                                      │
│                          ▼                                      │
│   ┌─────────────────────────────────────────────────────┐      │
│   │         PostgreSQL  +  AES-256-GCM Vault            │      │
│   │         40+ models  ·  Encrypted credentials        │      │
│   └─────────────────────────────────────────────────────┘      │
│                                                                 │
│                        PocketWatch                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features

### Portfolio Module — Digital Assets

| Feature | Description |
|---------|-------------|
| **Multi-chain balances** | Aggregate wallets across 20+ chains (Ethereum, Solana, Arbitrum, Base, Optimism, Polygon, BSC, Avalanche, and more) via Zerion |
| **Exchange integration** | Connect Binance, Coinbase, Kraken, OKX, Bybit, and 40+ exchanges via CCXT |
| **Transaction history** | Full EVM tx history with spam filtering, classification, and cost-basis tracking |
| **Staking analytics** | Track positions, APY, rewards earned, and hourly snapshot history |
| **DeFi positions** | Monitor liquidity pools, lending, and yield farming |
| **NFT gallery** | View your collection with metadata from Alchemy |
| **Airdrop scanner** | Discover unclaimed airdrops across supported protocols |
| **Cost basis & PnL** | Lot-based cost tracking with realized gains for tax prep |
| **Historical snapshots** | Net worth over time with interactive charts |

### Finance Module — Traditional Banking

| Feature | Description |
|---------|-------------|
| **Bank account sync** | Connect accounts via Plaid or SimpleFIN |
| **Budget management** | Set category-based spending budgets with visual progress |
| **Subscription detection** | Automatically find and manage recurring charges |
| **Credit card tracking** | Track cards, rewards points, and spending by issuer |
| **Investment accounts** | View brokerage holdings synced through Plaid |
| **Smart categorization** | AI-assisted transaction categorization with custom rules |
| **Insights & analytics** | Spending trends, forecasts, and financial health breakdown |

### Core Platform

| Feature | Description |
|---------|-------------|
| **Encrypted vault** | Single-user, password-derived AES-256-GCM encryption |
| **Dark / light mode** | System-aware with manual toggle |
| **PWA installable** | Works as a native-like app on mobile and desktop |
| **Customizable sidebar** | Drag, reorder, show/hide navigation items |
| **Responsive design** | Full mobile support with bottom tab navigation |
| **Background sync** | Automated portfolio refresh, staking snapshots, and tx sync |

---

## Architecture

### Tech Stack

```
Frontend                          Backend                         Data
─────────────────────────────     ──────────────────────────      ──────────────────────
Next.js 16 (App Router)           API Routes (Next.js)            PostgreSQL
React 19                          Prisma ORM 7                    40+ models
Tailwind CSS 4                    bcrypt + AES-256-GCM            Encrypted at rest
React Query (TanStack)            Session cookies                 Snapshot history
Recharts + Lightweight Charts     Rate limiting                   Sync state tracking
Material Symbols                  Background workers              Provider call gates
wagmi v2 + viem                   CCXT (exchange connector)
Reown AppKit                      Plaid / SimpleFIN SDK
```

### How Data Flows

```
                    ┌──────────────────────────┐
                    │     Browser / PWA         │
                    │     (React 19 + wagmi)    │
                    └────────────┬─────────────┘
                                 │
                                 ▼
                    ┌──────────────────────────┐
                    │    Next.js API Routes     │
                    │    /api/portfolio/*       │
                    │    /api/finance/*         │
                    │    /api/auth/*            │
                    └────────────┬─────────────┘
                                 │
                    ┌────────────┼─────────────┐
                    ▼            ▼              ▼
            ┌────────────┐ ┌──────────┐ ┌────────────┐
            │  Zerion    │ │  Plaid   │ │   CCXT     │
            │  Alchemy   │ │ SimpleFIN│ │  Binance   │
            │  CoinGecko │ │          │ │  Coinbase  │
            │  DefiLlama │ │          │ │  Kraken    │
            │  Etherscan │ │          │ │  40+ more  │
            └─────┬──────┘ └────┬─────┘ └─────┬──────┘
                  │             │              │
                  └─────────────┼──────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │       PostgreSQL          │
                    │                          │
                    │  Wallets · Balances       │
                    │  Transactions · Snapshots │
                    │  Budgets · Subscriptions  │
                    │  Staking · DeFi · NFTs    │
                    │  Cards · Investments      │
                    │                          │
                    │  All credentials          │
                    │  AES-256-GCM encrypted    │
                    └──────────────────────────┘
```

### Vault Authentication

PocketWatch uses a **single-user vault** model — no user accounts, no sign-ups. The first person to set a password owns the vault.

```
  ┌───────────────┐        ┌───────────────────────┐
  │  First Visit  │───────▶│  Set vault password   │
  │  (no vault)   │        │  (min 8 characters)   │
  └───────────────┘        └───────────┬───────────┘
                                       │
                                       ▼
                           ┌───────────────────────┐
                           │  PBKDF2 key derivation │
                           │         +              │
                           │  AES-256-GCM vault     │
                           │  created & encrypted   │
                           └───────────┬───────────┘
                                       │
                                       ▼
                           ┌───────────────────────┐
  ┌───────────────┐        │  Session cookie set    │
  │ Return Visit  │───────▶│  (httpOnly, strict,    │
  │ (vault exists)│        │   7-day expiry)        │
  └───────────────┘        └───────────┬───────────┘
         │                             │
         ▼                             ▼
  ┌───────────────┐        ┌───────────────────────┐
  │ Enter password│───────▶│     /portfolio         │
  │ to unlock     │        │  (dashboard loads)     │
  └───────────────┘        └───────────────────────┘
```

> **If you forget the password, data cannot be recovered.** You can only wipe the vault and start fresh.

---

## Getting Started

### Prerequisites

| Requirement | Version |
|-------------|---------|
| Node.js | 18+ (20+ recommended) |
| PostgreSQL | 14+ |
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

Set the minimum required variables in `.env`:

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

### 4. Start the dev server

```bash
npm run dev
```

Open **http://localhost:3000** and set your vault password.

### Production build

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
| `ENCRYPTION_KEY` | 32-byte hex string — generate with `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | Your app's public URL |

### Recommended

These unlock the core data integrations:

| Variable | What it enables | Get it at |
|----------|----------------|-----------|
| `ZERION_API_KEY` | Multi-chain portfolio balances | [zerion.io/developers](https://zerion.io/developers) |
| `COINGECKO_API_KEY` | Token prices & market data | [coingecko.com/en/api](https://www.coingecko.com/en/api) |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | EVM RPC, tx history, NFTs | [alchemy.com](https://www.alchemy.com/) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Browser wallet connection | [cloud.walletconnect.com](https://cloud.walletconnect.com) |

### Background Workers

For automatic data refresh via scheduled cron jobs:

| Variable | Protects |
|----------|----------|
| `STAKING_CRON_SECRET` | `/api/internal/staking/snapshot-hourly` |
| `HISTORY_CRON_SECRET` | `/api/internal/history/sync-worker` |
| `PORTFOLIO_REFRESH_CRON_SECRET` | `/api/internal/portfolio/refresh-worker` |
| `SNAPSHOT_WORKER_SECRET` | `/api/internal/snapshot-worker` |

Generate each with `openssl rand -hex 16`.

### Provider Throttling

Sensible defaults — tune if you hit rate limits:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORTFOLIO_REFRESH_TTL_MS` | `300000` | 5 min cooldown between refreshes |
| `ZERION_MIN_INTERVAL_MS` | `20000` | 20s between Zerion API calls |
| `ALCHEMY_MIN_INTERVAL_MS` | `500` | 500ms between Alchemy calls |
| `CCXT_MIN_INTERVAL_MS` | `15000` | 15s between exchange API calls |
| `DEFI_LLAMA_MIN_INTERVAL_MS` | `1000` | 1s between DefiLlama calls |

---

## Project Structure

```
PocketWatch/
├── prisma/
│   └── schema.prisma              # Database schema (40+ models)
├── public/
│   └── img/                       # Logos, PWA icons, OG images
├── src/
│   ├── app/
│   │   ├── (dashboard)/           # All authenticated pages
│   │   │   ├── portfolio/         # Digital asset pages
│   │   │   │   ├── page.tsx       #   Overview dashboard
│   │   │   │   ├── accounts/      #   Wallet & exchange management
│   │   │   │   ├── balances/      #   On-chain, exchange, manual
│   │   │   │   ├── history/       #   Transactions, PnL, snapshots
│   │   │   │   ├── settings/      #   API keys, sync controls
│   │   │   │   ├── staking/       #   Staking positions & APY
│   │   │   │   ├── defi/          #   DeFi position analytics
│   │   │   │   ├── nfts/          #   NFT gallery
│   │   │   │   └── airdrops/      #   Airdrop scanner
│   │   │   └── finance/           # Traditional finance pages
│   │   │       ├── page.tsx       #   Finance dashboard
│   │   │       ├── accounts/      #   Bank accounts (Plaid/SimpleFIN)
│   │   │       ├── budgets/       #   Budgets & subscriptions
│   │   │       ├── cards/         #   Credit card tracking
│   │   │       ├── categorize/    #   Transaction categorization
│   │   │       ├── investments/   #   Brokerage holdings
│   │   │       ├── settings/      #   Provider settings
│   │   │       └── transactions/  #   Transaction list
│   │   └── api/
│   │       ├── auth/              #   Vault auth (setup/unlock/lock/reset)
│   │       ├── portfolio/         #   Portfolio data endpoints
│   │       ├── finance/           #   Finance data endpoints
│   │       └── internal/          #   Background worker endpoints
│   ├── components/
│   │   ├── portfolio/             # Portfolio UI (overview, balances, history, ...)
│   │   ├── finance/               # Finance UI (budgets, cards, insights, ...)
│   │   ├── layout/                # Sidebar, header, mobile bottom nav
│   │   └── ui/                    # Shared primitives (inputs, buttons, modals)
│   ├── hooks/
│   │   ├── portfolio/             # React Query hooks (one file per domain)
│   │   └── finance/               # Finance hooks (accounts, budgets, ...)
│   ├── lib/
│   │   ├── portfolio/             # Business logic
│   │   │   ├── transaction-fetcher/   # Multi-chain tx fetching
│   │   │   ├── staking/               # Staking analytics engine
│   │   │   ├── cost-basis/            # Tax lot tracking
│   │   │   ├── vesting-claims/        # Vesting schedule scanners
│   │   │   └── yields/                # Yield aggregation
│   │   ├── finance/               # Plaid sync, categorization, crypto
│   │   ├── defillama/             # Protocol data integration
│   │   └── contracts/             # Smart contract ABIs
│   └── types/                     # Shared TypeScript interfaces
├── .env.example                   # Environment variable template
├── next.config.ts                 # Next.js + security headers
├── tailwind.config.ts             # Theme + design tokens
└── package.json
```

---

## Data Providers

PocketWatch aggregates data from multiple sources. All credentials are encrypted at rest.

### Crypto & Blockchain

| Provider | What it does | Key needed? |
|----------|-------------|-------------|
| **Zerion** | Multi-chain balance aggregation, positions, portfolio charts | Yes (free tier available) |
| **Alchemy** | EVM transaction history, NFT metadata, RPC provider | Yes (free tier available) |
| **CoinGecko** | Token prices, market data, historical prices | Yes (free tier available) |
| **DefiLlama** | Protocol TVL, yields, token prices | No (fully free) |
| **Etherscan** | EVM transaction scanning (+ Arbiscan, Basescan, etc.) | Optional |
| **CCXT** | Centralized exchange balances & history | Exchange API keys |

### Traditional Finance

| Provider | What it does | Key needed? |
|----------|-------------|-------------|
| **Plaid** | Bank account sync, transactions, investment holdings | Yes |
| **SimpleFIN** | Alternative bank sync (community-driven) | Yes |

### Other Integrations

| Provider | What it does |
|----------|-------------|
| **WalletConnect / Reown** | Browser wallet connection (MetaMask, Coinbase, etc.) |
| **Telegram** | Alert & notification delivery via bot |
| **Google Sheets** | Portfolio data export |

---

## Database

PocketWatch uses **PostgreSQL** with **Prisma ORM**. The schema has **40+ models** organized around:

```
User & Auth               Portfolio                    Finance
─────────────             ─────────────                ─────────────
User                      TrackedWallet                FinanceCredential
Session (encrypted DEK)   PortfolioSnapshot            FinanceInstitution
ExternalApiKey            TransactionCache             FinanceBudget
                          TransactionSyncState         FinanceSubscription
                          ManualBalance                FinanceCategoryRule
                          StakingSnapshot              FinanceSnapshot
                          StakingPosition              FinanceInvestmentHolding
                          CostBasisLot                 CreditCardProfile
                          RealizedGain                 FinanceRecurringStream
                          ChartCache                   PlaidDataSnapshot
```

### Key design decisions

- **Encrypted fields** — API keys and credentials use AES-256-GCM with a per-user DEK, wrapped by the master `ENCRYPTION_KEY`
- **Snapshot history** — Balances are periodically captured for historical charts
- **Sync state** — Each provider has dedicated sync state tables for incremental updates
- **Rate limiting** — `ProviderCallGate` model enforces per-provider rate limits

### Common commands

```bash
npx prisma migrate deploy          # Apply pending migrations
npx prisma migrate dev --name xxx  # Create new migration (dev)
npx prisma studio                  # Visual database browser
```

---

## Security

### Threat Model

PocketWatch is designed for **single-user self-hosting**. It assumes:

- The server runs on trusted infrastructure (your machine, VPS, or PaaS)
- Network access is restricted (local or behind HTTPS reverse proxy)
- The attacker does not have filesystem access

### Encryption & Auth

```
Vault Password
      │
      ▼
   bcrypt (cost 12)  ──────▶  Stored hash (auth check)
      │
      ▼
   PBKDF2 derivation ──────▶  Data Encryption Key (DEK)
      │
      ▼
   AES-256-GCM  ───────────▶  Encrypts all:
                                 • API keys (Zerion, Alchemy, etc.)
                                 • Bank tokens (Plaid access tokens)
                                 • Exchange credentials (CCXT)
```

### Security Headers

| Header | Value |
|--------|-------|
| Content-Security-Policy | Restrictive with enumerated sources |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Strict-Transport-Security | 2 years, includeSubDomains, preload |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | Camera, microphone, geolocation disabled |

### Session Security

| Property | Value |
|----------|-------|
| Cookie flags | `httpOnly`, `secure`, `sameSite=strict` |
| Session duration | 7 days |
| Rate limiting | Per-IP, per-endpoint |

### Deployment Checklist

- [ ] Use HTTPS in production (TLS termination via reverse proxy)
- [ ] Generate real cron secrets: `openssl rand -hex 16`
- [ ] Restrict network access (firewall / Cloudflare Access)
- [ ] Back up the `ENCRYPTION_KEY` — lose it and all encrypted data is gone
- [ ] Regular `pg_dump` for database backups
- [ ] Run `npm audit` periodically

---

## Deployment

PocketWatch works with any platform that supports Node.js + PostgreSQL.

### Railway / Render / Fly.io

1. Connect your GitHub repo
2. Set environment variables in the platform dashboard
3. Build: `npm run build`
4. Start: `npm start`
5. Add PostgreSQL and set `DATABASE_URL` + `DATABASE_URL_UNPOOLED`

### Background Jobs

Set up cron jobs for automatic data sync:

```bash
# Every 15 min — refresh portfolio balances
curl -X POST https://your-app.com/api/internal/portfolio/refresh-worker \
  -H "Authorization: Bearer $PORTFOLIO_REFRESH_CRON_SECRET"

# Every hour — staking snapshot
curl -X POST https://your-app.com/api/internal/staking/snapshot-hourly \
  -H "x-staking-cron-secret: $STAKING_CRON_SECRET"

# Every 6 hours — transaction history sync
curl -X POST https://your-app.com/api/internal/history/sync-worker \
  -H "x-history-cron-secret: $HISTORY_CRON_SECRET"
```

Most PaaS platforms (Railway, Render, Vercel) support scheduled jobs natively.

---

## Development

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint check |
| `npm run db:prepare` | Prisma generate + migrate |

### Code Conventions

| Rule | Limit |
|------|-------|
| Page files | Max 400 lines |
| Components | Max 300 lines, one per file |
| API routes | Max 200 lines |
| Hooks | React Query with query key factories |
| Styling | Tailwind + CSS variables (`var(--foreground)`, etc.) |
| Icons | Material Symbols Rounded |
| Toasts | sonner |
| Errors | `apiError()` helper, never expose raw DB errors |

### Adding a New Data Provider

```
1. Create client         src/lib/portfolio/your-provider.ts
2. Add API route         src/app/api/portfolio/your-endpoint/route.ts
3. Create hook           src/hooks/portfolio/use-your-data.ts
4. Wire up UI            src/components/portfolio/your-component.tsx
5. (Optional) Add key    ExternalApiKey model via settings UI
```

---

## Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/amazing-thing`
3. Follow the code conventions above
4. Verify the build: `npm run build`
5. Open a pull request

---

## License

[MIT](LICENSE)

---

<p align="center">
  <sub>Built with Next.js, Prisma, and too many API keys.</sub>
</p>
