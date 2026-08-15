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

export async function signPendingTwoFactorToken(
  userId: string,
  rememberMe = false
): Promise<string> {
  return new SignJWT({ userId, purpose: '2fa_pending', rememberMe: Boolean(rememberMe) })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(JWT_SECRET);
}

export async function verifyPendingTwoFactorToken(
  token: string
): Promise<{ userId: string; rememberMe: boolean } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (payload.purpose !== '2fa_pending' || typeof payload.userId !== 'string') return null;
    return {
      userId: payload.userId,
      rememberMe: Boolean(payload.rememberMe),
    };
  } catch {
    return null;
  }
}
