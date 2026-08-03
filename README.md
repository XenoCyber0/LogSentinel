# AI Log Analyzer

Enterprise-grade AI-powered log analysis for security analysts. Upload raw log files, get structured threat reports with severity ratings, IP analysis, and remediation recommendations — powered by Claude.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Database:** PostgreSQL 16 via Prisma 7 (pg adapter)
- **Auth:** RS256 JWT access tokens (15 min, in-memory) + rotating httpOnly refresh-token cookies (30 days) with family-reuse detection
- **AI:** Anthropic Claude, OpenRouter (free tier), Groq, or any OpenAI-compatible endpoint — selectable via `AI_PROVIDER`
- **State:** Zustand (auth) + TanStack Query (server state) + React Hook Form
- **UI:** Tailwind CSS 4 + Radix UI + Recharts + sonner

## Prerequisites

- Node.js 20+
- Docker (for local PostgreSQL) or a hosted Postgres (e.g. Supabase)

## Setup

```bash
# 1. Copy env template and fill in values
cp .env.example .env
```

```bash
# 2. Start PostgreSQL (local dev)
docker compose up -d
```

```bash
# 3. Install + migrate + seed
npm install
npx prisma migrate dev
npm run prisma:seed
```

```bash
# 4. Run
npm run dev
```

Open <http://localhost:3000>. Log in with the seeded demo account:

```
analyst@seclab.io / Demo1234!
```

## Environment variables

See [`.env.example`](.env.example) for the full annotated list. Required:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RSA keypair (PKCS#8 / SPKI PEM, newlines escaped as `\n`) |
| `AI_PROVIDER` | `anthropic` (paid) or `openai-compatible` (free tiers via OpenRouter / Groq / Ollama / …) |
| `ANTHROPIC_API_KEY` | Only when `AI_PROVIDER=anthropic` |
| `OPENAI_COMPATIBLE_API_KEY` / `_BASE_URL` / `_MODEL` | Only when `AI_PROVIDER=openai-compatible`. Defaults: OpenRouter base, Llama 3.3 70B free. |
| `AI_MAX_INPUT_TOKENS` | Per-request token cap (default 6000 — Groq free-tier safe) |
| `UPSTASH_REDIS_REST_URL` / `..._TOKEN` | Distributed rate limiting (fail-open if placeholders) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Storage (optional at runtime) |
| `NEXT_PUBLIC_APP_URL` | App origin (JWT issuer/audience) |

JWT key generation:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private_pkcs8.pem
openssl rsa -pubout -in jwt_private_pkcs8.pem -out jwt_public.pem
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `start` | Production build / serve |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run prisma:migrate` | Run migrations |
| `npm run prisma:seed` | Seed demo data |
| `npm run db:reset` | Drop + re-migrate + re-seed (destructive) |

## Architecture

```
src/
├── app/
│   ├── (auth)/login|register/    # Public auth pages
│   ├── dashboard/                # Protected app (proxy.ts gates on refresh cookie)
│   └── api/
│       ├── auth/                 # login / logout / refresh / register
│       ├── sessions/             # CRUD + /:id/analyze (Claude)
│       └── alerts/
├── lib/
│   ├── ai/                       # analyzer.ts (provider-agnostic) + provider.ts + sanitizer.ts
│   ├── auth/                     # jwt.ts (RS256 sign/verify) + session.ts (refresh rotation)
│   ├── db/prisma.ts              # Prisma client (globalThis singleton)
│   ├── security/                 # rateLimiter.ts + getClientIp.ts
│   └── logger/winston.ts
├── proxy.ts                      # Edge proxy: redirects /dashboard/* → /login if no cookie
└── stores/authStore.ts           # Zustand; accessToken in-memory only
```

**Security model:** Access tokens are short-lived RS256 JWTs kept in memory (never persisted to localStorage). Refresh tokens are random 64-byte hex strings stored as SHA-256 hashes in Postgres, set as httpOnly `SameSite=Strict` cookies, and rotated on every refresh. Reuse of a rotated token invalidates the entire token family.

**Contributor guidance:** see [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md).

## Docker (production image)

```bash
docker build -t ai-log-analyzer .
```

The `Dockerfile` produces a standalone Next.js build (`output: 'standalone'`). You still need a reachable PostgreSQL — `docker-compose.yml` only provisions the database for local dev.
