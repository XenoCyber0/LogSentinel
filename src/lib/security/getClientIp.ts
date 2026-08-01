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

  // IPv4: four dot-separated octets 0-255, no leading zeros beyond "0" itself
  // (stringified check rejects "01" / "001" octet padding tricks).
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every((p) => {
      const n = Number(p);
      return Number.isInteger(n) && n >= 0 && n <= 255 && p === String(n);
    });
  }

  // IPv6: at least one colon, and composed only of valid hex digits and colons
  // (with at most one "::" compression). This rejects garbage like
  // "1:2:3:4:5:6:7:8:9:bad" while still accepting ::1 and full/short forms.
  if (ip.includes(':')) {
    if (!/^[0-9a-fA-F:]+$/.test(ip)) return false;
    if ((ip.match(/::/g) ?? []).length > 1) return false;
    const colons = (ip.match(/:/g) ?? []).length;
    // Without "::" compression a full address has exactly 8 groups (7 colons);
    // with it, fewer groups are fine but there must still be structure.
    if (!ip.includes('::') && colons !== 7) return false;
    if (ip.startsWith(':') && !ip.startsWith('::')) return false;
    if (ip.endsWith(':') && !ip.endsWith('::')) return false;
    return true;
  }

  return false;
}
