import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const COOKIE_NAME = 'session';

const REMEMBER_MAX_AGE_SEC = 60 * 60 * 24 * 30;
const REMEMBER_JWT_EXP = '30d';
const SESSION_JWT_EXP = '12h';

export type UserRole = 'attendee' | 'organizer' | 'admin';

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface SessionOptions {
  rememberMe?: boolean;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload, rememberMe = false) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? REMEMBER_JWT_EXP : SESSION_JWT_EXP)
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload, options: SessionOptions = {}) {
  const rememberMe = Boolean(options.rememberMe);
  const token = await signSession(payload, rememberMe);
  const cookieStore = await cookies();

  const cookie: {
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'lax';
    path: string;
    maxAge?: number;
  } = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  };

  if (rememberMe) {
    cookie.maxAge = REMEMBER_MAX_AGE_SEC;
  }

  cookieStore.set(COOKIE_NAME, token, cookie);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export type PendingLoginPurpose = 'login_email_otp' | '2fa_pending';

export async function signPendingLoginToken(
  userId: string,
  purpose: PendingLoginPurpose,
  rememberMe = false
): Promise<string> {
  return new SignJWT({ userId, purpose, rememberMe: Boolean(rememberMe) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(purpose === 'login_email_otp' ? '15m' : '5m')
    .sign(JWT_SECRET);
}

export async function signPendingTwoFactorToken(userId: string, rememberMe = false) {
  return signPendingLoginToken(userId, '2fa_pending', rememberMe);
}

export async function verifyPendingLoginToken(
  token: string,
  expectedPurpose?: PendingLoginPurpose
): Promise<{ userId: string; rememberMe: boolean; purpose: PendingLoginPurpose } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const purpose = payload.purpose as string;
    if (purpose !== 'login_email_otp' && purpose !== '2fa_pending') return null;
    if (typeof payload.userId !== 'string') return null;
    if (expectedPurpose && purpose !== expectedPurpose) return null;
    return {
      userId: payload.userId,
      rememberMe: Boolean(payload.rememberMe),
      purpose: purpose as PendingLoginPurpose,
    };
  } catch {
    return null;
  }
}

export async function verifyPendingTwoFactorToken(
  token: string
): Promise<{ userId: string; rememberMe: boolean } | null> {
  const pending = await verifyPendingLoginToken(token, '2fa_pending');
  if (!pending) return null;
  return { userId: pending.userId, rememberMe: pending.rememberMe };
}

/** Magic link for guest view-my-tickets (email-bound, 1 hour). */
export async function signTicketsMagicLink(email: string) {
  const normalized = email.trim().toLowerCase();
  return new SignJWT({ purpose: 'tickets_magic', email: normalized })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

export async function verifyTicketsMagicLink(
  token: string
): Promise<{ email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.purpose !== 'tickets_magic') return null;
    if (typeof payload.email !== 'string' || !payload.email.includes('@')) return null;
    return { email: payload.email.toLowerCase() };
  } catch {
    return null;
  }
}