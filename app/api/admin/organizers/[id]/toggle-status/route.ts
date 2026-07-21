import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const users = await sql`SELECT status FROM users WHERE id = ${id}`;
    const current = users[0]?.status === 'suspended' ? 'active' : 'suspended';

    await sql`UPDATE users SET status = ${current} WHERE id = ${id}`;
    return NextResponse.json({ success: true, status: current });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}