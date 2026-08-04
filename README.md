# LogSentinel

**AI-powered log forensics for security analysts.** Paste or upload raw logs — nginx, auth.log, syslog, Windows Event, JSON app output, Apache — get a structured threat report with severity ratings, per-IP analysis, attack timelines, and concrete remediation steps. **Bring your own AI key** (free tier on OpenRouter or Groq works out of the box). Your logs never leave your machine.

Built for self-hosting: a single `npm run dev` (or `docker compose up`) gives you a full analyst workbench. No SaaS, no accounts at third parties, no telemetry.

## Why self-hosted?

Security teams can't paste production logs into someone else's cloud. LogSentinel runs on your hardware, talks directly from your box to your chosen LLM API (OpenRouter / Groq / Cerebras / Ollama / Anthropic — your call), and stores analyses in a database you control. The only network egress is to the AI provider you configured.

## Stack

- **App:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind 4 + Radix UI
- **Auth:** RS256 JWT access tokens (15 min, in-memory) + rotating httpOnly refresh-token cookies (30 days) with family-reuse detection
- **DB:** PostgreSQL via Prisma 7
- **AI:** Pluggable provider layer — Anthropic Claude, OpenRouter, Groq, Cerebras, Ollama, or any other service exposing `POST /v1/chat/completions`. Hardened JSON extraction survives malformed free-tier model output.
- **State:** Zustand (auth) + TanStack Query (server state) + React Hook Form
- **Charts:** Recharts

## Quick start (5 minutes)

### 0. What you need

- Node.js 20+
- A Postgres database — easiest: `docker compose up -d postgres` runs one locally. Or use Supabase / Neon / any hosted Postgres.

### 1. Clone + install

```bash
git clone https://github.com/XenoCyber0/LogSentinel.git
cd LogSentinel
npm install
```

### 2. Generate JWT signing keys

The auth layer uses RS256. Generate a keypair:

**Linux/macOS:**
```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private_pkcs8.pem
openssl rsa -pubout -in jwt_private_pkcs8.pem -out jwt_public.pem
```

**Windows (PowerShell, requires [Git for Windows](https://git-scm.com/) which bundles openssl):**
```powershell
& "C:\Program Files\Git\usr\bin\openssl.exe" genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt_private_pkcs8.pem
& "C:\Program Files\Git\usr\bin\openssl.exe" rsa -pubout -in jwt_private_pkcs8.pem -out jwt_public.pem
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Default | What to put |
|---|---|---|
| `DATABASE_URL` | — | `postgresql://seclog:seclog_dev@localhost:5432/seclog` (matches `docker-compose.yml`) |
| `JWT_PRIVATE_KEY` | — | Contents of `jwt_private_pkcs8.pem`, newlines escaped as `\n` |
| `JWT_PUBLIC_KEY` | — | Contents of `jwt_public.pem`, newlines escaped as `\n` |
| `AI_PROVIDER` | `anthropic` | `openai-compatible` (recommended free tier) |
| `OPENAI_COMPATIBLE_BASE_URL` | — | `https://openrouter.ai/api/v1` |
| `OPENAI_COMPATIBLE_API_KEY` | — | Get one free at https://openrouter.ai/keys |
| `OPENAI_COMPATIBLE_MODEL` | — | `meta-llama/llama-3.3-70b-instruct:free` |
| `UPSTASH_REDIS_REST_URL` + `_TOKEN` | — | Free at https://upstash.com/ — used for rate limiting. Can use placeholder values in dev. |
| `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` | — | If using Supabase; not required if you're on local Postgres |
| `NEXT_PUBLIC_APP_URL` | — | `http://localhost:3000` for dev |

The full annotated list is in [`.env.example`](.env.example).

### 4. Migrate + seed

```bash
npx prisma migrate dev
npm run prisma:seed
```

The seed creates a demo analyst account: `analyst@seclab.io` / `Demo1234!` — **change or delete this before exposing the app anywhere.**

### 5. Run

```bash
npm run dev
```

Open http://localhost:3000, sign in with the demo account, go to **Sessions → New Log Analysis**, paste a log file, hit Analyze.

## Using a different AI provider

LogSentinel treats the LLM as a black box behind an OpenAI-compatible `/v1/chat/completions` endpoint. To swap providers, change three env vars and restart:

| Provider | `OPENAI_COMPATIBLE_BASE_URL` | Notes |
|---|---|---|
| OpenRouter (recommended free) | `https://openrouter.ai/api/v1` | 50 req/day free per model |
| Groq | `https://api.groq.com/openai/v1` | Fast, generous free TPM. IP-blocklist aggressively — don't run under VPN. |
| Cerebras | `https://api.cerebras.ai/v1` | Fastest inference available |
| Ollama (local) | `http://localhost:11434/v1` | Fully offline |
| Anthropic (paid, native) | — | Set `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY` instead |

`AI_MAX_INPUT_TOKENS=6000` (default) is calibrated for Groq's 12k TPM free tier. Raise it (e.g. `16000`) on higher-tier providers to send more context per request.

## Production deployment

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

Don't forget to set `NODE_ENV=production` and rotate the seeded demo user.

## Security model — what's protected, what isn't

- **Prompt injection defense.** Log content is sanitized before being sent to the AI ([`src/lib/ai/sanitizer.ts`](src/lib/ai/sanitizer.ts)). The system prompt explicitly tells the model to treat log data as untrusted.
- **XSS-safe UI.** All AI-returned strings are sanitized (DOMPurify policy) before render ([`src/lib/security/sanitize.ts`](src/lib/security/sanitize.ts)).
- **Rate limiting.** IP-based on auth endpoints, user-based on analysis. Upstash Redis required in prod ([`src/lib/security/rateLimiter.ts`](src/lib/security/rateLimiter.ts)).
- **Refresh-token family reuse detection.** If a refresh token is presented twice, all tokens in its family are revoked server-side.
- **Authorization.** Sessions, alerts, IP records are strictly scoped per `userId`. Admin endpoints require `role=ADMIN`, set via DB only — there's no privilege-escalation route in the UI.

**Not included (by design):** TLS termination (use a reverse proxy), backups of your Postgres (use `pg_dump` cron), DDoS mitigation (Cloudflare in front).

## Development

```bash
npm run dev          # hot-reload dev server
npm test             # vitest unit tests (17 passing as of v0.1.0)
npm run typecheck    # strict TS
npm run lint         # ESLint
npm run build        # production bundle (must stay green)
```

Provider smoke test against a real API (no DB):

```bash
npx tsx --env-file=.env scripts/dev-provider-test.ts
```

## Repo layout

```
prisma/schema.prisma               — data model + migrations
src/app/(auth)/                    — login + register pages
src/app/(legal)/                   — privacy + terms
src/app/api/auth/                  — login · logout · register · refresh · change-password · api-token
src/app/api/sessions/ + [id]/      — session CRUD + /analyze (AI invocation)
src/app/api/alerts/                — alert inbox
src/app/api/admin/                 — admin user + audit viewers
src/app/api/export/                — session export
src/app/dashboard/                 — analyst UX (sessions, alerts, admin, settings)
src/components/                    — UI primitives + charts
src/lib/ai/                        — provider, analyzer, sanitizer
src/lib/auth/                      — JWT RS256 sign/verify, session + refresh-token lifecycle
src/lib/db/prisma.ts               — pg-adapter Prisma client
src/lib/security/                  — rate limiter, XSS sanitizer, client-IP extraction
src/middleware.ts                  — thin auth gate (cookie check, not verify)
scripts/                           — dev-provider-test.ts, test-big-log.ts (413 regression), dev-mock-provider.ts
```

## Contributing

This repo started as a single-developer project. Conventional Commits are welcome (`feat:`, `fix:`, `chore:`); please keep PRs small. Husky runs lint-staged on commit so `npm run lint` stays green.

## License

MIT — see [`LICENSE`](LICENSE).

## Acknowledgments

Built on Next.js, Prisma, TanStack Query, Zustand, Tailwind, Recharts, Sonner, Radix UI. AI analysis rides on generous free tiers from OpenRouter community models, Groq, and Cerebras.
