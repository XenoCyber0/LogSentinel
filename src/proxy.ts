import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (edge runtime is NOT
// supported — proxy runs on Node.js only). This proxy is the first line of
// defense for the /dashboard/* routes: it checks for the httpOnly
// `refreshToken` cookie. If absent, we redirect to /login before the
// dashboard layout ever renders.
//
// The cookie is the *refresh* token, not the access token — the access
// token lives in the in-memory Zustand store on the client (see fix #7).
// The presence of the refresh cookie proves the user has at least
// previously logged in on this browser; the dashboard layout / page-level
// useEffect will then verify the accessToken is still valid and call
// /api/auth/refresh to mint a new one if it has expired.
export function proxy(request: NextRequest) {
  const refreshToken = request.cookies.get('refreshToken')?.value;

  if (!refreshToken) {
    const loginUrl = new URL('/login', request.url);
    // Preserve where the user was trying to go, so login can bounce them
    // back after successful auth.
    const next = request.nextUrl.pathname + request.nextUrl.search;
    loginUrl.searchParams.set('next', next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // The dashboard routes live under /dashboard/* (real URL segment, not a
  // route group). Match all dashboard paths so we don't gate /login or
  // /register (which are in the (auth) group at /login, /register) or any
  // other public route.
  matcher: [
    '/dashboard',
    '/dashboard/:path*',
  ],
};
