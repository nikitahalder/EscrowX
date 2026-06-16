# EscrowX

A production-grade decentralized escrow platform built on [Stellar](https://stellar.org/) / [Soroban](https://soroban.stellar.org/). Smart contracts lock client funds before work begins and release them only on approval — protecting both clients and freelancers from payment fraud.

---

## Features

- **On-chain escrow** — funds held in a Soroban smart contract, never in a custodial wallet
- **Milestone-based payments** — projects are broken into milestones; each is approved individually
- **Dispute resolution** — arbitrator can resolve disputes by splitting or releasing funds on-chain
- **USDC payments** — uses Stellar USDC (no volatility risk)
- **Freighter wallet** — sign every transaction in your browser wallet; the backend never holds user keys
- **1% platform fee** — deducted at release time via smart contract

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, TypeScript, TailwindCSS, shadcn/ui |
| Backend | NestJS, Prisma ORM, PostgreSQL |
| Smart Contract | Soroban (Rust), `wasm32v1-none` target |
| File Storage | Cloudflare R2 |
| Infrastructure | Docker Compose, Turborepo monorepo |
| Wallet | Freighter |

---

## Monorepo Structure

```
EscrowX/
├── apps/
│   ├── web/          # Next.js 15 frontend
│   ├── api/          # NestJS REST API
│   └── contracts/    # Soroban smart contract (Rust)
├── packages/         # Shared TypeScript packages
├── docker-compose.yml
└── turbo.json
```

---

## Smart Contract (Testnet)

| Field | Value |
|---|---|
| Contract ID | `CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO` |
| WASM Hash | `512f6a9ac3084e13caa73d3d4d063938853d527a2487fb6c7e35bf118775ea8e` |
| Deploy TX | `67818174c4b5daf1db623b8b9ab194cf0781d32daf40bdb617d9483397c9e338` |
| USDC Contract | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Platform Fee | 1% (100 bps) |

### Contract Functions

`create_project` · `fund_project` · `accept_project` · `submit_milestone` · `approve_milestone` · `raise_dispute` · `resolve_dispute` · `cancel_project` · `get_project` · `get_milestone` · `get_dispute` · `get_project_count`

---

## Getting Started

### Prerequisites

- Node.js >= 20, npm >= 10
- Docker & Docker Compose
- [Freighter wallet](https://freighter.app/) browser extension (for wallet interactions)

### 1. Clone & install

```bash
git clone https://github.com/nikitahalder/EscrowX.git
cd EscrowX
npm install
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` and fill in:

```env
DATABASE_URL="postgresql://escrowx:escrowx_pass@localhost:5433/escrowx_db"
JWT_SECRET="your-long-random-secret"

STELLAR_NETWORK="testnet"
ESCROW_CONTRACT_ID="CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO"
PLATFORM_WALLET_SECRET="your-platform-wallet-secret"
PLATFORM_WALLET_PUBLIC="your-platform-wallet-public"
USDC_CONTRACT_ID="CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"

# Cloudflare R2 (optional for file uploads)
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_PUBLIC_URL=""
```

### 3. Start infrastructure

```bash
docker compose up -d   # starts PostgreSQL (port 5433) and Redis (port 6380)
```

### 4. Run database migrations

```bash
npm run db:migrate
```

### 5. Start development servers

```bash
npm run dev
```

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:4000 |
| Swagger Docs | http://localhost:4000/api/docs |

---

## Escrow Flow

```
Client                      Smart Contract              Freelancer
  │                               │                         │
  │── create_project ────────────>│                         │
  │── fund_project (USDC) ───────>│ (funds locked)          │
  │                               │<── accept_project ──────│
  │                               │<── submit_milestone ────│
  │── approve_milestone ─────────>│ (funds released – 1%)  │
  │                               │──── USDC transfer ─────>│
```

If there is a dispute, an arbitrator calls `resolve_dispute` on-chain to split or release funds.

---

## API Documentation

Interactive Swagger docs are available at `http://localhost:4000/api/docs` when the API is running.

---

## License

MIT
