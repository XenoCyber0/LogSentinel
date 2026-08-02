import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),
    JWT_PRIVATE_KEY: z.string(),
    JWT_PUBLIC_KEY: z.string(),
    // AI provider selection — one of: 'anthropic' (paid) or 'openai-compatible'
    // (covers OpenRouter free tier, Groq, Together, OpenAI proper, Ollama, etc.)
    AI_PROVIDER: z.enum(["anthropic", "openai-compatible"]).default("anthropic"),
    ANTHROPIC_API_KEY: z.string().optional(),
    OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
    OPENAI_COMPATIBLE_BASE_URL: z.string().url().default("https://openrouter.ai/api/v1"),
    OPENAI_COMPATIBLE_MODEL: z.string().default("meta-llama/llama-3.3-70b-instruct:free"),
    // Hard cap on tokens sent to the AI per request. Default 6000 matches the
    // tightest common free tier (Groq on_demand ≈ 12k TPM — we leave half for
    // response + second retry). Raise to ~16000 for paid tiers, or remove the
    // cap via AI_MAX_INPUT_TOKENS=0 if you're on Anthropic.
    AI_MAX_INPUT_TOKENS: z.coerce.number().int().min(0).default(6000),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string(),
    SENTRY_DSN: z.string().optional(),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["error", "warn", "info", "debug"]).default("info"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  },
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    JWT_PRIVATE_KEY: process.env.JWT_PRIVATE_KEY,
    JWT_PUBLIC_KEY: process.env.JWT_PUBLIC_KEY,
    AI_PROVIDER: process.env.AI_PROVIDER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_COMPATIBLE_API_KEY: process.env.OPENAI_COMPATIBLE_API_KEY,
    OPENAI_COMPATIBLE_BASE_URL: process.env.OPENAI_COMPATIBLE_BASE_URL,
    OPENAI_COMPATIBLE_MODEL: process.env.OPENAI_COMPATIBLE_MODEL,
    AI_MAX_INPUT_TOKENS: process.env.AI_MAX_INPUT_TOKENS,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
