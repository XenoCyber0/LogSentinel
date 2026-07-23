import type { NextRequest } from 'next/server';

/**
 * Extracts the client IP address from a Next.js request.
 *
 * Parses the `x-forwarded-for` header defensively: takes only the FIRST
 * (leftmost) IP in the comma-separated list, validates it is a plausible
 * IPv4 or IPv6 address, and returns 'unknown' if the header is absent or
 * malformed.
 *
 * SECURITY NOTE: In production behind a reverse proxy (nginx, Vercel, etc.),
 * `x-forwarded-for` can be spoofed by the client unless the proxy is
 * configured to strip/overwrite it. For true anti-spoofing, maintain a
 * trusted-proxy allowlist and validate `x-forwarded-proto` / the proxy's
 * own IP. This helper mitigates naive spoofing but is NOT a complete
 * defense on its own.
 */
export function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first && isValidIp(first)) {
      return first;
    }
  }

  return 'unknown';
}

function isValidIp(ip: string): boolean {
  // Reject empty or absurdly long strings early.
  if (!ip || ip.length > 45) return false;

  // IPv4: four dot-separated octets 0-255.
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((p) => {
      const n = Number(p);
      return Number.isInteger(n) && n >= 0 && n <= 255 && p === String(n);
    });
  }

  // IPv6: must contain a colon. Defer to a simple structural check —
  // at least two colons or the "::" compression marker.
  if (ip.includes(':')) {
    return ip.indexOf(':') !== ip.lastIndexOf(':') || ip.includes('::');
  }

  return false;
}
