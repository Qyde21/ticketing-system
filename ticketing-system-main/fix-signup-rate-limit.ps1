# Run this from your project root: C:\Users\user\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File fix-signup-rate-limit.ps1
#
# Adds rate limiting to signup (5 attempts / 15 min, by IP and by email) —
# every other auth route (login, forgot-password) already had this, signup
# was the one gap, leaving it open to mass account creation and email spam.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Write-Host "Writing: app\api\auth\signup\route.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import { checkRateLimit, recordAttempt, getClientIp } from '@/lib/rateLimit';
import crypto from 'crypto';

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, phone, role } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (String(password).length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const ip = getClientIp(req);

    // Rate limit by IP and by the target email — prevents mass account
    // creation and repeated verification-email spam to one address, the
    // same protection already applied to login and forgot-password.
    const allowed = await checkRateLimit({
      type: 'signup',
      email: normalizedEmail,
      ip,
      maxAttempts: MAX_ATTEMPTS,
      windowMinutes: WINDOW_MINUTES,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }
    await recordAttempt('signup', normalizedEmail, ip);

    // Signup can only create attendees or organizers — never admin
    const finalRole = role === 'organizer' ? 'organizer' : 'attendee';

    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await sql`
      INSERT INTO users (email, phone, password_hash, full_name, role, email_verified)
      VALUES (${normalizedEmail}, ${phone ?? null}, ${passwordHash}, ${fullName}, ${finalRole}, false)
      RETURNING id, email, full_name, role
    `;

    if (finalRole === 'organizer') {
      await sql`
        INSERT INTO organizer_profiles (user_id, business_name)
        VALUES (${user.id}, ${fullName})
      `;
    }

    // Generate a verification token (same pattern as password reset: random raw
    // token emailed to the user, only a SHA-256 hash of it stored server-side).
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await sql`
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
      VALUES (${user.id}, ${tokenHash}, ${expiresAt.toISOString()})
    `;

    const verifyUrl = `${req.nextUrl.origin}/api/auth/verify-email?token=${rawToken}`;

    try {
      await sendVerificationEmail({ toEmail: user.email, fullName: user.full_name, verifyUrl });
    } catch (emailErr) {
      console.error('Failed to send verification email:', emailErr);
    }

    // Deliberately NOT logging the user in here — no session cookie is set.
    // They only get a session once they click the link in verify-email/route.ts.
    return NextResponse.json(
      { message: 'Account created. Please check your email to confirm your account.', email: user.email },
      { status: 201 }
    );
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

'@
[System.IO.File]::WriteAllText("app\api\auth\signup\route.ts", $content, $utf8NoBom)

if (-not (Test-Path -LiteralPath "app\api\auth\signup\route.ts")) {
    Write-Host "ERROR: file was not created!" -ForegroundColor Red
} else {
    Write-Host "Confirmed on disk." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Add rate limiting to signup route"""
    Write-Host "  git push origin main"
}
