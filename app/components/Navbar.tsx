import Link from 'next/link';
import { getSession } from '@/lib/auth';
import NavbarClient from './NavbarClient';

export default async function Navbar() {
  const session = await getSession();

  const dashboardHref =
    session?.role === 'admin'
      ? '/admin/dashboard'
      : session?.role === 'organizer'
      ? '/organizer/dashboard'
      : null;

  return (
    <nav className="bg-neutral-900 text-white sticky top-0 z-50 border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight">
          <span className="bg-amber-400 text-black px-2 py-0.5 rounded text-sm font-black">TH</span>
          TicketHub
        </Link>

        <div className="flex items-center gap-6 text-sm font-medium">
          <Link href="/" className="text-neutral-300 hover:text-white transition-colors">
            Events
          </Link>

          {session ? (
            <>
              {dashboardHref && (
                <Link href={dashboardHref} className="text-neutral-300 hover:text-white transition-colors">
                  {session.role === 'admin' ? 'Admin' : 'Dashboard'}
                </Link>
              )}
              {session.role === 'organizer' && (
                <Link href="/organizer/payouts" className="text-neutral-300 hover:text-white transition-colors">
                  Payouts
                </Link>
              )}
              {session.role === 'admin' && (
                <>
                  <Link href="/admin/organizers" className="text-neutral-300 hover:text-white transition-colors">
                    Organizers
                  </Link>
                  <Link href="/admin/events" className="text-neutral-300 hover:text-white transition-colors">
                    All Events
                  </Link>
                </>
              )}
              <NavbarClient userName={session.email} />
            </>
          ) : (
            <>
              <Link href="/pricing" className="text-neutral-300 hover:text-white transition-colors hidden sm:block">
                Pricing
              </Link>
              <Link href="/signup?role=organizer" className="text-neutral-300 hover:text-white transition-colors hidden sm:block">
                Sell tickets
              </Link>
              <Link href="/login" className="text-neutral-300 hover:text-white transition-colors">
                Log in
              </Link>
              <Link
                href="/signup"
                className="bg-amber-400 text-black px-4 py-1.5 rounded-full font-semibold hover:bg-amber-300 transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}