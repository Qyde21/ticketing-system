import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { active } = await req.json();

    const [promo] = await sql`
      SELECT pc.id, pc.active, e.organizer_id
      FROM promo_codes pc
      JOIN events e ON e.id = pc.event_id
      WHERE pc.id = ${id}
    `;

    if (!promo) {
      return NextResponse.json({ error: 'Promo code not found' }, { status: 404 });
    }
    if (promo.organizer_id !== session.userId && session.role !== 'admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const newActive = typeof active === 'boolean' ? active : !promo.active;

    const [updated] = await sql`
      UPDATE promo_codes SET active = ${newActive} WHERE id = ${id}
      RETURNING id, code, active
    `;

    return NextResponse.json({ code: updated });
  } catch (err) {
    console.error('Promo code update error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
