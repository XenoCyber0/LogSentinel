import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // env validation runs at module import time (t3-oss/env-nextjs), so we
    // must set dummy vars before any test file loads, not in setupFiles.
    env: {
      DATABASE_URL: 'postgresql://dummy:dummy@localhost:5432/dummy',
      JWT_PRIVATE_KEY: 'dummy-private-key',
      JWT_PUBLIC_KEY: 'dummy-public-key',
      UPSTASH_REDIS_REST_URL: 'https://dummy.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'placeholder-skip-rate-limit',
      SUPABASE_URL: 'https://dummy.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'dummy-service-role-key',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
      NEXT_PUBLIC_SUPABASE_URL: 'https://dummy.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dummy-anon-key',
      SKIP_ENV_VALIDATION: 'false', // let validation run to catch real drift
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

