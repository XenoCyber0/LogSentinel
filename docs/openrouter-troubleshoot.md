# OpenRouter API Key / Model Troubleshooting

## The "analysis temporarily unavailable" trap

If you see this UI state after clicking **Re-analyze**:

```
AI Threat Summary
UNKNOWN
Analysis temporarily unavailable. Manual review recommended.
```

the Anthropic/OpenAI-compatible provider is throwing, and the analyzer is
converting that to a soft fallback. **This is expected behavior for transient
errors** but if your config is broken you'll see it every time. Follow these
steps:

## Step 1 — Restart your dev server after editing `.env`

`@t3-oss/env-nextjs` validates and freezes env at **process start**. Editing
`.env` while the server runs is a no-op. Restart first.

```powershell
# Kill the running dev server (Ctrl-C), then
npm run dev
```

## Step 2 — Verify `.env` syntax is correct

```powershell
Get-Content .env | Select-String -Pattern "AI_PROVIDER|ANTHROPIC|OPENAI_COMPATIBLE"
```

You should see exactly:
```
AI_PROVIDER=openai-compatible        (or anthropic)
ANTHROPIC_API_KEY="sk-ant-..."       (only if using Anthropic)
OPENAI_COMPATIBLE_API_KEY="sk-or-v1-..."
OPENAI_COMPATIBLE_BASE_URL="https://openrouter.ai/api/v1"
OPENAI_COMPATIBLE_MODEL="meta-llama/llama-3.3-70b-instruct:free"
```

**Common mistakes:**
| Mistake | What breaks |
|---|---|
| `AI_PROVIDER` missing | Defaults to `anthropic` → uses the (likely retired) Anthropic key |
| Wrong case — `ai_provider` or `OpenAI_Compatible_...` | Not picked up at all |
| Missing `:free` suffix in model name | Model not in free tier, gets 404 |
| `meta-llama/llama-3.3-70b-instruct` (no suffix) | 404 — requires paid credits |

## Step 3 — Test your OpenRouter key + model directly (curl)

This eliminates the app entirely. If it doesn't work here, it can't work in the app.

```powershell
$key = "sk-or-v1-YOUR-REAL-KEY-HERE"
$model = "meta-llama/llama-3.3-70b-instruct:free"
Invoke-RestMethod -Uri "https://openrouter.ai/api/v1/chat/completions" `
  -Method Post `
  -Headers @{ "Authorization" = "Bearer $key"; "Content-Type" = "application/json" } `
  -Body (@{
    model = $model
    messages = @(@{ role = "user"; content = "Reply with the single word OK" })
    max_tokens = 8
  } | ConvertTo-Json -Depth 3)
```

**Expected response:** OK

**Possible failures:**

| Error | Cause | Fix |
|---|---|---|
| `401 Unauthorized` | Wrong API key | Make a new key at https://openrouter.ai/keys |
| `404 Not Found` | Wrong model name | Exact free-tier name; see list below |
| `429 Too Many Requests` | Free tier rate limit (~50/day per model) | Wait, or try a different `:free` model |
| Stuck / never returns | Your key's IP needs Cloudflare challenge | OpenRouter free tier occasionally rate-limits residential IPs; use a different network or paid model |

## Step 4 — Confirmed working free-tier models (Dec 2024)

Pick ONE and use it verbatim:

```
meta-llama/llama-3.3-70b-instruct:free       ← recommended
qwen/qwen-2-7b-instruct:free
microsoft/phi-3-mini-128k-instruct:free
google/gemma-2-9b-it:free
```

Full list: https://openrouter.ai/models?filter=free

## Step 5 — Still broken?

Post in Anthropic Discord #api-support with:
1. The output of Step 3 (scrub your key)
2. The full error from the app (it'll now say "Authentication failed" or
   "Model unavailable", not the "temporarily unavailable" fallback)
