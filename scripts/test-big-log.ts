import { analyzeLog } from '../src/lib/ai/analyzer';

// Build a 10k-char realistic access log with actual threat patterns
const threats = [
  '198.51.100.55 - - [02/Aug/2026:03:34:11 +0000] "POST /admin/login.php HTTP/1.1" 401 221 "-" "sqlmap/1.7"',
  '198.51.100.55 - - [02/Aug/2026:03:34:12 +0000] "GET /products.php?id=SELECT%20*%20OR%201=1-- HTTP/1.1" 200 532 "-" "sqlmap/1.7"',
];
const cleanLine = '10.0.0.1 - - [02/Aug/2026:03:34:00 +0000] "GET /index.html HTTP/1.1" 200 1234 "-" "Mozilla/5.0"\n';
const lines = [threats[0], ...Array(40).fill(cleanLine.trim()), threats[1]];

const bigLog = lines.join('\n');
console.log(`Input size: ${bigLog.length} chars`);

try {
  const result = await analyzeLog(bigLog);
  console.log(`✅ No 413 error`);
  console.log(`   token cap applied: ${result.totalLines} lines returned by AI`);
  console.log(`   threats found: ${result.threats.length}`);
} catch (e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.log(`❌ Failed: ${msg}`);
  process.exit(1);
}
