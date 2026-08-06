import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import NavbarShell from './NavbarShell';

export default async function Navbar() {
  const session = await getSession();

  const dashboardHref =
    session?.role === 'admin'
      ? '/admin/dashboard'
      : session?.role === 'organizer'
      ? '/organizer/dashboard'
      : session?.role === 'attendee'
      ? '/attendee/dashboard'
      : undefined;

  let isVerifiedOrganizer = true;
  if (session?.role === 'organizer') {
    const [profile] = await sql`
      SELECT is_verified FROM organizer_profiles WHERE user_id = ${session.userId}
    `;
    isVerifiedOrganizer = profile?.is_verified === true;
  }

  return (
    <NavbarShell
      userEmail={session?.email}
      userRole={session?.role}
      dashboardHref={dashboardHref}
      isVerifiedOrganizer={isVerifiedOrganizer}
    />
  );
}