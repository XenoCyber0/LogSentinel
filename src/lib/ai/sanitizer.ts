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

export function detectPII(logContent: string): string[] {
  const piiPatterns = [
    { name: 'Email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
    { name: 'SSN', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
    { name: 'Credit Card', regex: /\b(?:\d{4}[- ]?){3}\d{4}\b/g },
    { name: 'API Key', regex: /(?:sk-|pk_|AKIA)[a-zA-Z0-9]{20,}/gi },
    { name: 'IP Address', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  ];

  const detected: string[] = [];

  piiPatterns.forEach(({ name, regex }) => {
    if (regex.test(logContent)) {
      detected.push(name);
    }
  });

  return detected;
}

export function validateLogSize(content: string, isFile: boolean = false): { valid: boolean; error?: string } {
  const MAX_PASTE = 5 * 1024 * 1024;
  const MAX_FILE = 20 * 1024 * 1024;

  const maxSize = isFile ? MAX_FILE : MAX_PASTE;

  if (content.length > maxSize) {
    return {
      valid: false,
      error: `Log exceeds maximum size of ${isFile ? '20MB' : '5MB'}`,
    };
  }

  return { valid: true };
}
