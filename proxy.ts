import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

const roleRules = [
  { prefix: '/admin', roles: ['admin'] },
  { prefix: '/organizer', roles: ['organizer', 'admin'] },
  { prefix: '/scan', roles: ['organizer', 'admin'] },
  { prefix: '/attendee', roles: ['attendee', 'organizer', 'admin'] },
];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const rule = roleRules.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return NextResponse.next();

  const token = req.cookies.get('session')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!rule.roles.includes(payload.role as string)) {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/admin/:path*', '/organizer/:path*', '/scan/:path*', '/attendee/:path*'],
};