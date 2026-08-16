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
    const [account] = await sql`
      SELECT u.status, COALESCE(op.is_verified, false) AS is_verified
      FROM users u
      LEFT JOIN organizer_profiles op ON op.user_id = u.id
      WHERE u.id = ${session.userId}
    `;
    isVerifiedOrganizer = account?.is_verified === true && account?.status !== 'suspended';
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