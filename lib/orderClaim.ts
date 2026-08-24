import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signOrderClaim(reference: string): Promise<string> {
  return new SignJWT({ purpose: 'order_claim', reference })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(JWT_SECRET);
}

export async function verifyOrderClaim(
  token: string | null | undefined,
  reference: string
): Promise<boolean> {
  if (!token || !reference) return false;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return (
      payload.purpose === 'order_claim' &&
      typeof payload.reference === 'string' &&
      payload.reference === reference
    );
  } catch {
    return false;
  }
}
