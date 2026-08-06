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
    const [profile] = await sql`
      SELECT is_verified FROM organizer_profiles WHERE user_id = ${session.userId}
    `;
    if (!profile?.is_verified) {
      redirect('/organizer/dashboard');
    }
  }

  return <>{children}</>;
}
