<div align="center">

# 🛡️ LogSentinel

**AI-powered log forensics for security analysts — self-hosted, no telemetry, bring your own key.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-7-2d3748)](https://www.prisma.io)
[![Tests](https://img.shields.io/badge/tests-17%20passing-brightgreen)](#development)

[Quick Start](#-quick-start-5-minutes) · [Providers](#-ai-providers) · [Security Model](#-security-model) · [Self-Hosting](#-production-deployment)

</div>

---

Drop in raw logs — **nginx, auth.log, syslog, Windows Event, JSON, Apache** — get back a structured threat report: severity ratings, per-IP analysis, attack timelines, and concrete remediation steps. Runs entirely on hardware you control. The only network egress is to the LLM provider *you* chose.

## ✨ Why LogSentinel?

Security teams can't paste production logs into someone else's cloud. LogSentinel gives you an analyst-grade workbench without surrendering your data:

- 🔒 **Local-first** — no SaaS, no third-party accounts, no telemetry
- 🔑 **Bring your own key** — free tiers on OpenRouter / Groq / Cerebras work out of the box
- 🌐 **Pluggable AI backend** — swap providers by changing 3 env vars
- 🧱 **Production-hardened** — prompt-injection defense, XSS-safe rendering, rate limiting, token family-reuse detection
- 🐳 **One command to run** — `npm run dev` or `docker compose up`

## 🧰 Stack

| Layer | Tech |
|---|---|
| **App** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Radix UI |
| **Auth** | RS256 JWT access tokens (15 min, in-memory) + rotating httpOnly refresh cookies (30 days) with family-reuse detection |
| **DB** | PostgreSQL via Prisma 7 |
| **AI** | Pluggable provider layer — Anthropic, OpenRouter, Groq, Cerebras, Ollama, or anything exposing `POST /v1/chat/completions`. Hardened JSON extraction survives malformed free-tier output. |
| **State** | Zustand (auth) · TanStack Query (server state) · React Hook Form |
| **Charts** | Recharts |

## 🚀 Quick Start (5 minutes)

### 0. Prerequisites

- Node.js 20+
- A Postgres database — easiest: `docker compose up -d postgres`. Or use Supabase / Neon / any hosted Postgres.

### 1. Clone & install

```bash
git clone https://github.com/XenoCyber0/LogSentinel.git
cd LogSentinel
npm install
```

### 2. Generate JWT signing keys

The auth layer uses RS256. Generate a keypair:

**Linux / macOS:**
```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private_pkcs8.pem
openssl rsa -pubout -in jwt_private_pkcs8.pem -out jwt_public.pem
```

**Windows (PowerShell,** requires [Git for Windows](https://git-scm.com/) which bundles openssl):
```powershell
& "C:\Program Files\Git\usr\bin\openssl.exe" genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private_pkcs8.pem
& "C:\Program Files\Git\usr\bin\openssl.exe" rsa -pubout -in jwt_private_pkcs8.pem -out jwt_public.pem
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in the essentials:

| Variable | What to put |
|---|---|
| `DATABASE_URL` | `postgresql://seclog:seclog_dev@localhost:5432/seclog` (matches `docker-compose.yml`) |
| `JWT_PRIVATE_KEY` | Contents of `jwt_private_pkcs8.pem`, newlines escaped as `\n` |
| `JWT_PUBLIC_KEY` | Contents of `jwt_public.pem`, newlines escaped as `\n` |
| `AI_PROVIDER` | `openai-compatible` (recommended free tier) |
| `OPENAI_COMPATIBLE_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENAI_COMPATIBLE_API_KEY` | Get one free at [openrouter.ai/keys](https://openrouter.ai/keys) |
| `OPENAI_COMPATIBLE_MODEL` | `meta-llama/llama-3.3-70b-instruct:free` |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | Free at [upstash.com](https://upstash.com/) — rate limiting. Placeholder values OK in dev. |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev |

The full annotated list is in [`.env.example`](.env.example).

### 4. Migrate + seed

```bash
npx prisma migrate dev
npm run prisma:seed
```

The seed creates a demo analyst account: **`analyst@seclab.io` / `Demo1234!`** — ⚠️ **change or delete this before exposing the app anywhere.**

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign in, go to **Sessions → New Log Analysis**, paste a log, hit **Analyze**. 🎉

## 🤖 AI Providers

LogSentinel treats the LLM as a black box behind an OpenAI-compatible endpoint. To swap providers, change three env vars and restart:

| Provider | `OPENAI_COMPATIBLE_BASE_URL` | Notes |
|---|---|---|
| **OpenRouter** *(recommended free)* | `https://openrouter.ai/api/v1` | 50 req/day free per model |
| **Groq** | `https://api.groq.com/openai/v1` | Fast, generous free TPM. Aggressive IP-blocklist — don't run under VPN. |
| **Cerebras** | `https://api.cerebras.ai/v1` | Fastest inference available |
| **Ollama** *(local)* | `http://localhost:11434/v1` | Fully offline |
| **Anthropic** *(paid, native)* | — | Set `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` instead |

> 💡 `AI_MAX_INPUT_TOKENS=6000` (default) is calibrated for Groq's 12k TPM free tier. Raise it (e.g. `16000`) on higher-tier providers to send more context per request.

## 🐳 Production Deployment

```bash
npm install --omit=dev
npx prisma migrate deploy
npm run build
npm start
```

Or with Docker:

```bash
docker build -t logsentinel .
docker run -p 3000:3000 --env-file .env logsentinel
```

Don't forget `NODE_ENV=production` and rotate the seeded demo user.

## 🔒 Security Model

**What's protected:**

- 🛡️ **Prompt injection defense** — log content is sanitized before being sent to the AI ([`src/lib/ai/sanitizer.ts`](src/lib/ai/sanitizer.ts)); the system prompt marks log data as untrusted
- 🧼 **XSS-safe UI** — all AI-returned strings are DOMPurify-sanitized before render ([`src/lib/security/sanitize.ts`](src/lib/security/sanitize.ts))
- 🚦 **Rate limiting** — IP-based on auth endpoints, user-based on analysis; Upstash Redis in prod ([`src/lib/security/rateLimiter.ts`](src/lib/security/rateLimiter.ts))
- 🔄 **Refresh-token family reuse detection** — a refresh token presented twice revokes its entire family server-side
- 👤 **Authorization** — sessions, alerts, and IP records scoped per `userId`; admin endpoints require `role=ADMIN` set via DB only — no privilege-escalation route in the UI

**Not included (by design):** TLS termination (use a reverse proxy), Postgres backups (`pg_dump` cron), DDoS mitigation (put Cloudflare in front).

## 🛠️ Development

```bash
npm run dev          # hot-reload dev server
npm test             # vitest unit tests
npm run typecheck    # strict TS
npm run lint         # ESLint
npm run build        # production bundle (must stay green)
```

Provider smoke test against a real API (no DB):

```bash
npx tsx --env-file=.env scripts/dev-provider-test.ts
```

## 📁 Repo Layout

```
prisma/schema.prisma      — data model + migrations
src/app/(auth)/           — login + register pages
src/app/api/auth/         — login · logout · register · refresh · change-password · api-token
src/app/api/sessions/     — session CRUD + /analyze (AI invocation)
src/app/api/alerts/       — alert inbox
src/app/api/admin/        — admin user + audit viewers
src/app/dashboard/        — analyst UX (sessions, alerts, admin, settings)
src/components/           — UI primitives + charts
src/lib/ai/               — provider, analyzer, sanitizer
src/lib/auth/             — JWT RS256 sign/verify, session + refresh lifecycle
src/lib/security/         — rate limiter, XSS sanitizer, client-IP extraction
scripts/                  — dev-provider-test, test-big-log (413 regression), dev-mock-provider
```

## 🤝 Contributing

This repo started as a single-developer project. Conventional Commits are welcome (`feat:`, `fix:`, `chore:`); please keep PRs small. Husky runs lint-staged on commit so `npm run lint` stays green.

## 📄 License

MIT — see [`LICENSE`](LICENSE).

---

<div align="center"><sub>Built on Next.js, Prisma, TanStack Query, Zustand, Tailwind, Recharts, Sonner, Radix UI. AI analysis rides on generous free tiers from OpenRouter, Groq, and Cerebras.</sub></div>
