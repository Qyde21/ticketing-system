import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { setSessionCookie } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get('google_oauth_state')?.value;

  // CSRF check: the state we get back must match the one we set before
  // sending the user to Google.
  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL('/login?oauthError=invalid_state', req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/login?oauthError=not_configured', req.url));
  }

  try {
    const redirectUri = `${req.nextUrl.origin}/api/auth/google/callback`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('Google token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('/login?oauthError=token_exchange_failed', req.url));
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    if (!profileRes.ok || !profile.sub || !profile.email) {
      console.error('Google profile fetch failed:', profile);
      return NextResponse.redirect(new URL('/login?oauthError=profile_fetch_failed', req.url));
    }

    const normalizedEmail = String(profile.email).trim().toLowerCase();

    // 1. Already linked before? Just log them in.
    const [existingLink] = await sql`
      SELECT u.id, u.email, u.role, u.status
      FROM oauth_accounts oa
      JOIN users u ON u.id = oa.user_id
      WHERE oa.provider = 'google' AND oa.provider_user_id = ${profile.sub}
    `;

    let user = existingLink;

    if (!user) {
      // 2. No link yet — does a user with this email already exist
      // (e.g. they originally signed up with email/password)? Link accounts
      // rather than creating a duplicate.
      const [existingByEmail] = await sql`SELECT id, email, role, status FROM users WHERE email = ${normalizedEmail}`;

      if (existingByEmail) {
        await sql`
          INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
          VALUES (${existingByEmail.id}, 'google', ${profile.sub})
          ON CONFLICT (provider, provider_user_id) DO NOTHING
        `;
        user = existingByEmail;
      } else {
        // 3. Brand new user. Google has already verified this email, so
        // email_verified starts true — no confirmation link needed.
        // Signs up as 'attendee' — organizers still go through the regular
        // signup form, since that path collects the business details an
        // organizer profile needs.
        const [newUser] = await sql`
          INSERT INTO users (email, full_name, role, email_verified, password_hash)
          VALUES (${normalizedEmail}, ${profile.name || normalizedEmail}, 'attendee', true, NULL)
          RETURNING id, email, role, status
        `;
        await sql`
          INSERT INTO oauth_accounts (user_id, provider, provider_user_id)
          VALUES (${newUser.id}, 'google', ${profile.sub})
        `;
        user = newUser;
      }
    }

    if (user.status === 'suspended') {
      return NextResponse.redirect(new URL('/login?oauthError=suspended', req.url));
    }

    await setSessionCookie({ userId: user.id, email: user.email, role: user.role });

    const dashboardPath =
      user.role === 'admin' ? '/admin/dashboard' :
      user.role === 'organizer' ? '/organizer/dashboard' :
      '/attendee/dashboard';

    const res = NextResponse.redirect(new URL(dashboardPath, req.url));
    res.cookies.delete('google_oauth_state');
    return res;
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return NextResponse.redirect(new URL('/login?oauthError=unexpected', req.url));
  }
}
