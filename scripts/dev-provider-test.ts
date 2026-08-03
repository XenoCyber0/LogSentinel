/**
 * Quick provider smoke test: runs analyzeLog() against a real threat sample
 * WITHOUT touching any DB or API route. Exercises the entire stack:
 *   sanitize -> size cap -> provider.complete -> JSON extraction/normalise
 *
 * Usage (PowerShell):
 *   # Current .env
 *   npx tsx --env-file=.env scripts/dev-provider-test.ts
 *
 *   # Try OpenRouter free tier instead of Groq
 *   $env:OPENAI_COMPATIBLE_API_KEY='sk-or-v1-xxxxx'
 *   $env:OPENAI_COMPATIBLE_BASE_URL='https://openrouter.ai/api/v1'
 *   $env:OPENAI_COMPATIBLE_MODEL='meta-llama/llama-3.3-70b-instruct:free'
 *   npx tsx --env-file=.env scripts/dev-provider-test.ts
 */
import { analyzeLog } from '../src/lib/ai/analyzer';
import { getAIProvider } from '../src/lib/ai/provider';
import { env } from '../src/env';

// 1.9k-char realistic mix (under any sane cap) covering the shapes we
// actually regex-classify: nginx access + sshd brute force + windows +
// ISO app + docker json. Triggers real findings instead of happy noise.
const SAMPLE = [
  '203.0.113.42 - - [02/Aug/2026:03:34:10 +0000] "GET /products.php?id=SELECT%20*%20OR%201=1-- HTTP/1.1" 200 532',
  '198.51.100.55 - - [02/Aug/2026:03:34:11 +0000] "POST /admin/login.php HTTP/1.1" 401 221',
  'Dec 10 06:55:46 server02 sshd[26443]: Invalid user service-account from 198.51.100.55 port 49231 ssh2',
  'Dec 10 06:55:48 server02 sshd[26445]: Invalid user support from 198.51.100.55 port 49238 ssh2',
  'powershell.exe -ExecutionPolicy Bypass -File C:\\Users\\Public\\update.ps1',
  '2026-08-02T03:35:05.123Z WARN Cache invalidation storm detected for user 9042',
  '{"log":"listening on :8080\\n","stream":"stdout","time":"2026-08-02T03:35:05.1Z"}',
].join('\n');

async function main() {
  const provider = getAIProvider();
  console.log('Provider configuration:');
  console.log(`  AI_PROVIDER    = ${env.AI_PROVIDER}`);
  console.log(`  base URL       = ${env.OPENAI_COMPATIBLE_BASE_URL ?? '(anthropic default)'}`);
  console.log(`  model          = ${env.OPENAI_COMPATIBLE_MODEL ?? '(anthropic default)'}`);
  console.log(`  maxInputTokens = ${provider.maxInputTokens ?? 'uncapped (Anthropic)'}`);
  console.log(`  sample size    = ${SAMPLE.length} chars`);
  console.log('');

  const t0 = Date.now();
  try {
    const result = await analyzeLog(SAMPLE);
    console.log(`✅ Analysis succeeded in ${Date.now() - t0}ms`);
    console.log(`   severity   = ${result.severity}`);
    console.log(`   logFormat  = ${result.logFormat}`);
    console.log(`   threats    = ${result.threats.length} (${result.threats.map((t) => t.severity).join(', ')})`);
    console.log(`   totalLines = ${result.totalLines}`);
    console.log(`   IPs        = ${result.ipAnalysis.length}`);
    process.exit(0);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    console.log(`❌ Analysis failed in ${Date.now() - t0}ms`);
    console.log(`   ${err.message ?? String(e)}`);
    console.log('');
    console.log('Diagnosis:');
    if (err.status === 401) console.log('   → Key rejected. Rotate and update .env (or env var above).');
    if (err.status === 404) console.log('   → Model name wrong. Check provider docs; OpenRouter requires the :free suffix.');
    if (err.status === 413) console.log('   → Input too large even after cap. Lower AI_MAX_INPUT_TOKENS in .env (try 4000).');
    if (err.status === 429) console.log('   → Rate limited — free-tier model is at its shared pool. Switch to a less popular :free model, add your own BYOK key, or retry off-peak.');
    if (err.status === undefined) console.log('   → Transient / network / parse error (not auth/rate-limit).');
    process.exit(1);
  }
}

main();
