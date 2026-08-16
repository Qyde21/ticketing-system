# Run this from your project root: C:\Users\user\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File fix-scan-route-blocked-attendees.ps1
#
# Root cause of "Scan Tickets" redirecting to homepage for staff-designated
# attendees: proxy.ts (the auth middleware) only allowed organizer/admin
# roles onto /scan/*, blocking attendees before they could ever reach the
# page — even though the real per-event authorization (checking event_staff)
# already worked correctly in /api/checkin. This adds "attendee" to the
# allowed roles for /scan/*, since the fine-grained check happens downstream.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Write-Host "Writing: proxy.ts" -ForegroundColor Cyan
$content = @'
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const roleRules = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/organizer', roles: ['organizer', 'admin'] },
  // Attendees are included here because door staff are regular attendee
  // accounts granted per-event scanning access via the event_staff table.
  // This middleware only checks broad role — the actual per-event check
  // (is this specific person allowed to scan for this specific event)
  // is enforced properly in /api/checkin, so this stays a coarse gate.
  { prefix: '/scan', roles: ['attendee', 'organizer', 'admin'] },
  { prefix: '/attendee', roles: ['attendee', 'organizer', 'admin'] },
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = roleRules.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get('session')?.value;
  if (!token) {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!rule.roles.includes(payload.role as string)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  } catch {
    const login = new URL('/login', req.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }
}

export const config = {
  matcher: ['/admin/:path*', '/organizer/:path*', '/scan/:path*', '/attendee/:path*'],
};

'@
[System.IO.File]::WriteAllText("proxy.ts", $content, $utf8NoBom)

if (-not (Test-Path -LiteralPath "proxy.ts")) {
    Write-Host "ERROR: file was not created!" -ForegroundColor Red
} else {
    Write-Host "Confirmed on disk." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Fix: allow attendee-role door staff through /scan middleware"""
    Write-Host "  git push origin main"
}
