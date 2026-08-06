import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Server-side guard so an unverified organizer can't reach this page directly
// by URL, even though the dashboard already hides the link to it. The actual
// API route (app/api/events/route.ts) also enforces this independently as
// the real backstop — this layout is just for a clean redirect instead of a
// confusing in-page error.
export default async function NewEventLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  if (session.role === 'organizer') {
    const [account] = await sql`
      SELECT u.status, COALESCE(op.is_verified, false) AS is_verified
      FROM users u
      LEFT JOIN organizer_profiles op ON op.user_id = u.id
      WHERE u.id = ${session.userId}
    `;
    if (account?.status === 'suspended' || account?.is_verified !== true) {
      redirect('/organizer/dashboard');
    }
  }

  return <>{children}</>;
}
