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

  return (
    <NavbarShell
      userEmail={session?.email}
      userRole={session?.role}
      dashboardHref={dashboardHref}
    />
  );
}