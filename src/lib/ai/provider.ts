import Anthropic from '@anthropic-ai/sdk';
import { env } from '@/env';

/**
 * AI provider abstraction. Two providers are wired up:
 *
 *  - 'anthropic'           — Claude via the official SDK. Paid, highest quality.
 *                            Uses ANTHROPIC_API_KEY.
 *  - 'openai-compatible'   — OpenRouter (free Llama/DeepSeek/Mistral models),
 *                            Groq, Together, OpenAI proper, Ollama, LM Studio,
 *                            and any other server exposing /v1/chat/completions.
 *                            Uses OPENAI_COMPATIBLE_API_KEY/BASE_URL/MODEL.
 *
 * Only credentials for the ACTIVE provider are required. ANTHROPIC_API_KEY can
 * be left unset entirely when AI_PROVIDER=openai-compatible, which is the
 * free-tier default.
 *
 * `complete()` normalises responses to a single string. Cost-tracking fields
 * (tokens used / finish_reason) are dropped because the call-sites only need
 * the text — if token accounting is ever added, extend the return type here.
 */

export class AIProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly provider?: string,
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export interface AnalysisRequest {
  system: string;
  user: string;
  maxTokens: number;
}

export interface IAIProvider {
  complete(req: AnalysisRequest): Promise<string>;
  /**
   * Token budget the caller should cap the user message to, so the request
   * fits the provider's rate limit (TPM for most providers, per-request caps
   * for some). From the env override AI_MAX_INPUT_TOKENS. undefined means no
   * cap (Anthropic paid tiers). Converted to chars by the caller — callers
   * should use a conservative ~2.2/token for log data, less for prose.
   */
  readonly maxInputTokens?: number;
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

function stripQuotes(value: string): string {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

class AnthropicProvider implements IAIProvider {
  private client: Anthropic;
  private model: string;

  // Anthropic's paid tiers have high TPM/context; leave uncapped.
  readonly maxInputTokens = undefined;

  constructor(apiKey: string, model = 'claude-3-5-sonnet-20241022') {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(req: AnalysisRequest): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: 'user', content: req.user }],
    });

    const block = response.content[0];
    if (!block || block.type !== 'text') {
      throw new AIProviderError(
        'Unexpected response shape from Anthropic',
        undefined,
        'anthropic',
      );
    }
    return block.text;
  }
}

// ---------------------------------------------------------------------------
// OpenAI-compatible (OpenRouter / Groq / Together / OpenAI / Ollama / …)
// ---------------------------------------------------------------------------

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  error?: { message?: string; code?: number; type?: string };
}

class OpenAICompatibleProvider implements IAIProvider {
  readonly maxInputTokens?: number;

  constructor(
    private baseUrl: string,
    private apiKey: string,
    private model: string,
    maxInputTokens?: number,
  ) {
    // 0 disables the cap. Positive numbers are honored verbatim so the
    // operator can tighten for rate limits or loosen for paid tiers without
    // redeploying code.
    this.maxInputTokens = maxInputTokens && maxInputTokens > 0 ? maxInputTokens : undefined;
  }

  async complete(req: AnalysisRequest): Promise<string> {
    const url = `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        max_tokens: req.maxTokens,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const snippet = body.slice(0, 300);
      // 400 with "not a valid model ID" (OpenRouter), 404 from endpoint, and
      // 401 auth all indicate *operator problems* — they need to surface, not
      // be retried silently as "transient". Upstream rate limits (429) and
      // 5xx ARE transient so leave those to the analyzer's soft-fallback path.
      throw new AIProviderError(
        `OpenAI-compatible request failed (${res.status} ${res.statusText}): ${snippet}`,
        res.status,
        'openai-compatible',
      );
    }

    const json = (await res.json()) as ChatCompletionResponse;

    // OpenRouter returns HTTP 200 with an embedded `error` field for some
    // upstream failures (rate limits on free models, provider down). Fail
    // hard so the analyzer's catch sees the real reason.
    if (json.error) {
      throw new AIProviderError(
        `Provider error: ${json.error.message ?? 'unknown'}`,
        json.error.code,
        'openai-compatible',
      );
    }

    const choice = json.choices?.[0];
    const text = choice?.message?.content;

    // Empty content on a successful response usually means a stop-finish or
    // refusal. Both are informational — surface them.
    if (typeof text !== 'string' || text.length === 0) {
      const finishReason = choice?.finish_reason ?? 'unknown';
      throw new AIProviderError(
        `Provider returned empty content (finish_reason=${finishReason}). ` +
          'Free-tier models sometimes truncate or refuse long prompts. ' +
          'Try a different model in OPENAI_COMPATIBLE_MODEL.',
        undefined,
        'openai-compatible',
      );
    }
    return text;
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

let cached: IAIProvider | null = null;

/**
 * Returns the active AI provider. Throws with a clear operator-facing message
 * if the required credentials for AI_PROVIDER are missing, so misconfig surfaces
 * at call time rather than at boot (useful because env.ts is also pulled into
 * modules that don't touch AI at all — e.g. via prisma.ts).
 *
 * The provider instance is cached: Anthropic SDK is cheap to construct but the
 * key strip + URL normalisation only needs to happen once, and per-request
 * re-init makes the auth-failure log noisy.
 */
export function getAIProvider(): IAIProvider {
  if (cached) return cached;

  const provider = env.AI_PROVIDER;

  if (provider === 'anthropic') {
    const key = env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new AIProviderError(
        'AI_PROVIDER=anthropic but ANTHROPIC_API_KEY is not set. ' +
          'Generate a key at https://console.anthropic.com/settings/keys or ' +
          'switch to AI_PROVIDER=openai-compatible for a free tier (OpenRouter).',
        undefined,
        'anthropic',
      );
    }
    cached = new AnthropicProvider(stripQuotes(key));
    return cached;
  }

  const apiKey = env.OPENAI_COMPATIBLE_API_KEY;
  if (!apiKey) {
    throw new AIProviderError(
      'AI_PROVIDER=openai-compatible but OPENAI_COMPATIBLE_API_KEY is not set. ' +
        'Get a free key at https://openrouter.ai/keys (or point ' +
        'OPENAI_COMPATIBLE_BASE_URL at any OpenAI-compatible endpoint).',
      undefined,
      'openai-compatible',
    );
  }

  cached = new OpenAICompatibleProvider(
    env.OPENAI_COMPATIBLE_BASE_URL,
    stripQuotes(apiKey),
    env.OPENAI_COMPATIBLE_MODEL,
    env.AI_MAX_INPUT_TOKENS,
  );
  return cached;
}
