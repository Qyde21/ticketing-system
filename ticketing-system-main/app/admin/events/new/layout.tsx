import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

// This form page is a client component, so the auth check has to live in a
// layout wrapping it rather than in the page itself. Actual event creation
// is already protected at the API level (app/api/events/route.ts), but the
// form page itself was publicly viewable by anyone with the URL before this.
export default async function NewAdminEventLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    redirect('/login');
  }

  return <>{children}</>;
}
