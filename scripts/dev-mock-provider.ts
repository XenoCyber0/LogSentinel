// Shows the EXACT HTTP request analyzeLog() would send to OpenRouter —
// useful to audit before using a real key or quota. No external calls made.
import { createServer, Server, IncomingMessage } from 'http';
import type { AddressInfo } from 'net';
import { analyzeLog } from '../src/lib/ai/analyzer';

interface ChatCompletionRequestBody {
  model?: string;
  max_tokens?: number;
  temperature?: number;
  messages?: unknown[];
}

let capturedRequest: {
  method: string;
  headers: IncomingMessage['headers'];
  body: ChatCompletionRequestBody;
} | null = null;

const server: Server = createServer(async (req, res) => {
  let body = '';
  for await (const chunk of req) body += chunk;
  capturedRequest = {
    method: req.method ?? 'UNKNOWN',
    headers: req.headers,
    body: body ? (JSON.parse(body) as ChatCompletionRequestBody) : {},
  };

  // Reply with a valid AI response so analyzeLog() completes normally.
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    id: String(Date.now()),
    object: 'chat.completion',
    created: Date.now(),
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: JSON.stringify({
          summary: 'Mock response — no real AI call made.',
          severity: 'HIGH',
          logFormat: 'NGINX',
          timeRange: { start: '2026-08-02T03:34:10Z', end: '2026-08-02T03:34:12Z' },
          totalLines: 7,
          threats: [],
          ipAnalysis: [],
          timeline: [],
          recommendations: ['AuditAuthorizationHeaderOnlySendsYourBearerToken'],
        }),
      },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 1024, completion_tokens: 200, total_tokens: 1224 },
  }));
});

async function main() {
  const ADDRESS = await new Promise<string>((resolve) => {
    server.listen(0, () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`));
  });

// Point the app at the mock server
process.env.OPENAI_COMPATIBLE_BASE_URL = `${ADDRESS}/v1`;
process.env.OPENAI_COMPATIBLE_API_KEY = 'sk-mock-not-a-real-key';
process.env.OPENAI_COMPATIBLE_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

const SAMPLE = `203.0.113.42 - - [02/Aug/2026:03:34:10 +0000] "GET /products.php?id=SELECT%20* HTTP/1.1" 200 532
Dec 10 06:55:46 server02 sshd[26443]: Invalid user service-account from 198.51.100.55`;

console.log(`Mock server listening at ${ADDRESS}`);
console.log('Running analyzeLog() against it (no real API call)...\n');

const result = await analyzeLog(SAMPLE);

console.log('════════ CAPTURED REQUEST ════════');
console.log(`Method:  ${capturedRequest?.method}`);
console.log(`URL:     ${ADDRESS}/v1/chat/completions`);
console.log(`Headers: Authorization: Bearer ${capturedRequest?.headers['authorization']?.slice(-20)}`);
console.log(`         Content-Type: ${capturedRequest?.headers['content-type']}`);
console.log(`Payload:`);
console.log(JSON.stringify(capturedRequest?.body, null, 2));
console.log('════════ RESULT ════════');
console.log(`severity=${result.severity} logFormat=${result.logFormat} threats=${result.threats.length}`);

server.close();
process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
