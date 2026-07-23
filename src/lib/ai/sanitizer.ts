import sanitizeHtml from 'sanitize-html';

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+previous\s+instructions?/gi,
  /you\s+are\s+now/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /human\s*:/gi,
  /<\s*script/gi,
  /prompt\s+injection/gi,
  /override\s+instructions/gi,
  /disregard\s+all/gi,
];

export function sanitizeLogInput(input: string): string {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input;

  // Remove prompt injection patterns
  PROMPT_INJECTION_PATTERNS.forEach((pattern) => {
    sanitized = sanitized.replace(pattern, '[REDACTED]');
  });

  // HTML sanitization for XSS prevention
  sanitized = sanitizeHtml(sanitized, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });

  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  // Limit size (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (sanitized.length > MAX_SIZE) {
    sanitized = sanitized.substring(0, MAX_SIZE) + '\n[TRUNCATED]';
  }

  return sanitized.trim();
}
