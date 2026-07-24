import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { hashPassword, setSessionCookie } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password, fullName, phone, role } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Signup can only create attendees or organizers — never admin
    const finalRole = role === 'organizer' ? 'organizer' : 'attendee';

    const existing = await sql`SELECT id FROM users WHERE email = ${normalizedEmail}`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    const [user] = await sql`
      INSERT INTO users (email, phone, password_hash, full_name, role)
      VALUES (${normalizedEmail}, ${phone ?? null}, ${passwordHash}, ${fullName}, ${finalRole})
      RETURNING id, email, full_name, role
    `;

    if (finalRole === 'organizer') {
      await sql`
        INSERT INTO organizer_profiles (user_id, business_name)
        VALUES (${user.id}, ${fullName})
      `;
    }

    await setSessionCookie({ userId: user.id, email: user.email, role: user.role });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    console.error('Signup error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}