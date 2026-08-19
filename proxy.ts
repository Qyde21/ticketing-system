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
