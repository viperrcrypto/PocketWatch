# TrackMe — Portfolio Tracker

A multi-chain portfolio tracker for tracking wallet balances, transaction history, airdrops, and vesting claims.

## Features

- **Multi-wallet tracking** — Add any EVM wallet address (via Zerion API)
- **Blockchain balances** — Live token positions across Ethereum, Arbitrum, Base, Polygon, BSC, Solana
- **Exchange balances** — Connect CEX accounts (Binance, Coinbase, etc.) via API key
- **Manual balances** — Track any off-chain assets manually
- **Transaction history** — Browse wallet activity with P&L analytics
- **Airdrop scanner** — Detect unclaimed airdrops across protocols
- **Vesting claims** — Scan Sablier, Streamflow, Hedgey, LlamaPay, Team Finance
- **Address book** — Label addresses for easy identification
- **Portfolio snapshots** — Historical net worth tracking
- **Staking analytics** — Protocol APY, economic yield earned, hourly snapshots, closed-position freeze cache

## Stack

- **Next.js 15** (App Router)
- **Prisma** (PostgreSQL)
- **wagmi v2** + **RainbowKit** (wallet connection)
- **React Query** (data fetching)
- **Tailwind CSS**
- **Zerion API** (multi-chain balances)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your values
```

### 3. Set up the database

```bash
npx prisma db push
npx prisma generate
```

### 4. Run the development server

```bash
npm run dev
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | Yes | PostgreSQL direct connection (for migrations) |
| `ENCRYPTION_KEY` | Yes | 32-byte hex key for encrypting API keys |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | WalletConnect project ID |
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Recommended | Alchemy API key for EVM RPC |
| `ZERION_API_KEY` | For balances | Zerion API key for portfolio data |
| `COINGECKO_API_KEY` | For prices | CoinGecko API key |
| `STAKING_CRON_SECRET` | For hourly staking sync | Auth secret for `/api/internal/staking/snapshot-hourly` |

## Auth

Users connect their wallet (MetaMask, Coinbase, etc.) — no NFT or special token required. The wallet address serves as the user identity.
