import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  const { userId } = await params;

  const [updated] = await sql`
    UPDATE organizer_profiles SET is_verified = true
    WHERE user_id = ${userId}
    RETURNING id
  `;

  if (!updated) {
    return NextResponse.json({ error: 'Organizer profile not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}