import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Starts the Google OAuth flow. Redirects the browser straight to Google's
// consent screen — no JS needed, this route is just linked to directly from
// a plain <a href="/api/auth/google"> button.
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(new URL('/login?oauthError=not_configured', req.url));
  }

  // CSRF protection: a random state value, stored in a short-lived cookie and
  // compared against what Google sends back on the callback.
  const state = crypto.randomBytes(24).toString('hex');

  const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });

  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600, // 10 minutes — just needs to survive the round trip to Google and back
    path: '/',
  });
  return res;
}
