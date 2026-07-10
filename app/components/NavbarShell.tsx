'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface NavbarShellProps {
  userEmail?: string;
  userRole?: string;
  dashboardHref?: string;
}

export default function NavbarShell({ userEmail, userRole, dashboardHref }: NavbarShellProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
    setOpen(false);
  }

  const loggedInLinks = (
    <>
      <Link href="/" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Events</Link>
      {dashboardHref && <Link href={dashboardHref} onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">{userRole === 'admin' ? 'Admin' : 'Dashboard'}</Link>}
      {userRole === 'organizer' && <Link href="/organizer/payouts" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Payouts</Link>}
      {userRole === 'attendee' && <Link href="/inbox" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Inbox</Link>}
      {userRole === 'admin' && <>
        <Link href="/admin/organizers" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Organizers</Link>
        <Link href="/admin/events" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">All Events</Link>
        <Link href="/admin/payouts" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Payouts</Link>
      </>}
      <button onClick={handleLogout} className="text-neutral-300 hover:text-white transition-colors text-sm text-left">Log out</button>
    </>
  );

  const loggedOutLinks = (
    <>
      <Link href="/" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Events</Link>
      <Link href="/pricing" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Pricing</Link>
      <Link href="/signup?role=organizer" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Sell tickets</Link>
      <Link href="/login" onClick={() => setOpen(false)} className="text-neutral-300 hover:text-white transition-colors">Log in</Link>
      <Link href="/signup" onClick={() => setOpen(false)} className="bg-amber-400 text-black px-4 py-1.5 rounded-full font-semibold hover:bg-amber-300 transition-colors text-center">Sign up</Link>
    </>
  );

  return (
    <nav className="bg-neutral-900 text-white sticky top-0 z-50 border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-extrabold text-xl tracking-tight">
          <span className="bg-amber-400 text-black px-2 py-0.5 rounded text-sm font-black">TH</span>
          TicketHub
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6 text-sm font-medium">
          {userEmail ? loggedInLinks : loggedOutLinks}
        </div>

        {/* Mobile hamburger button */}
        <button onClick={() => setOpen(!open)} className="sm:hidden flex flex-col gap-1.5 p-2" aria-label="Menu">
          <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-white transition-all duration-200 ${open ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <div className="sm:hidden bg-neutral-800 border-t border-neutral-700 px-6 py-4 flex flex-col gap-4 text-sm font-medium">
          {userEmail ? loggedInLinks : loggedOutLinks}
        </div>
      )}
    </nav>
  );
}