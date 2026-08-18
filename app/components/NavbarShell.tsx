"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarShellProps {
  userEmail?: string;
  userRole?: string;
  dashboardHref?: string;
  isVerifiedOrganizer?: boolean;
}

export default function NavbarShell({ userEmail, userRole, isVerifiedOrganizer }: NavbarShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  const isLoggedIn = !!userEmail;
  const isActive = (path: string) => pathname === path || (path !== '/' && pathname.startsWith(path));

  const getLinkClass = (path: string) =>
    `transition py-1 ${
      isActive(path)
        ? 'text-cyan-400 font-semibold border-b-2 border-cyan-500'
        : 'text-slate-300 hover:text-white'
    }`;

  const getMobileLinkClass = (path: string) =>
    `flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition ${
      isActive(path)
        ? 'bg-indigo-600/25 text-cyan-300 border border-indigo-500/40'
        : 'text-slate-200 hover:bg-white/5 border border-transparent'
    }`;

  const roleLabel =
    userRole === 'admin' ? 'Admin' : userRole === 'organizer' ? 'Organizer' : userRole === 'attendee' ? 'Attendee' : '';

  return (
    <header className="bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition shrink-0" onClick={() => setMobileMenuOpen(false)}>
          <img src="/logo-badge.png" alt="TicketHub" className="h-10 w-10 rounded-lg" />
          <span className="text-lg sm:text-xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">TicketHub</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {isLoggedIn ? (
            <>
              <Link href="/" className={getLinkClass('/')}>Events</Link>
              {userRole === 'admin' && (
                <>
                  <Link href="/admin/dashboard" className={getLinkClass('/admin/dashboard')}>Admin</Link>
                  <Link href="/admin/organizers" className={getLinkClass('/admin/organizers')}>Organizers</Link>
                  <Link href="/admin/events" className={getLinkClass('/admin/events')}>All Events</Link>
                  <Link href="/admin/payouts" className={getLinkClass('/admin/payouts')}>Payouts</Link>
                  <Link href="/attendee/dashboard" className={getLinkClass('/attendee/dashboard')}>My Tickets</Link>
                </>
              )}
              {userRole === 'organizer' && (
                <>
                  <Link href="/organizer/dashboard" className={getLinkClass('/organizer/dashboard')}>Dashboard</Link>
                  {isVerifiedOrganizer && (
                    <Link href="/organizer/events/new" className={getLinkClass('/organizer/events/new')}>Create Event</Link>
                  )}
                  <Link href="/organizer/analytics" className={getLinkClass('/organizer/analytics')}>Analytics</Link>`n                  <Link href="/organizer/payouts" className={getLinkClass('/organizer/payouts')}>Payouts</Link>
                  <Link href="/account/security" className={getLinkClass('/account/security')}>Security</Link>
                </>
              )}
              {(userRole === 'attendee' || userRole === 'organizer' || userRole === 'admin') && (
                <>
                  {userRole !== 'admin' && (
                    <Link href="/attendee/dashboard" className={getLinkClass('/attendee/dashboard')}>My Tickets</Link>
                  )}
                  <Link href="/favorites" className={getLinkClass('/favorites')}>Saved</Link>
                  <Link href="/inbox" className={getLinkClass('/inbox')}>Inbox</Link>
                </>
              )}
              <button onClick={handleLogout} className="text-slate-300 hover:text-white transition cursor-pointer">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/" className={getLinkClass('/')}>Events</Link>
              <Link href="/signup?role=attendee" className={getLinkClass('/signup?role=attendee')}>Get Ticket</Link>
              <Link href="/signup?role=organizer" className={getLinkClass('/signup?role=organizer')}>Sell Tickets</Link>
              <Link href="/login" className={getLinkClass('/login')}>Sign in</Link>
              <Link href="/signup" className="bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white px-4 py-2 rounded-lg font-semibold transition shadow-sm">
                Get Started
              </Link>
            </>
          )}
        </nav>

        <div className="flex md:hidden items-center">

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-200 hover:text-white focus:outline-none p-2 rounded-lg hover:bg-white/5"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 border border-slate-800 p-3.5 mb-3">
              <img src="/logo-badge.png" alt="" className="h-11 w-11 rounded-xl shadow-lg shadow-indigo-950/50" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-base leading-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">TicketHub</p>
                {isLoggedIn ? (
                  <p className="text-xs text-slate-400 truncate mt-0.5">
                    {roleLabel && <span className="text-cyan-400/90 font-semibold">{roleLabel}</span>}
                    {roleLabel && userEmail ? ' · ' : ''}
                    {userEmail}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500 mt-0.5">Events & tickets in Kenya</p>
                )}
              </div>
            </div>
          </div>

          <nav className="px-3 pb-5 space-y-1">
            {isLoggedIn ? (
              <>
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/')}>
                  Events
                </Link>

                {userRole === 'admin' && (
                  <>
                    <Link href="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/admin/dashboard')}>Admin</Link>
                    <Link href="/admin/organizers" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/admin/organizers')}>Organizers</Link>
                    <Link href="/admin/events" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/admin/events')}>All Events</Link>
                    <Link href="/admin/payouts" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/admin/payouts')}>Payouts</Link>
                  </>
                )}

                {userRole === 'organizer' && (
                  <>
                    <Link href="/organizer/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/dashboard')}>Dashboard</Link>
                    {isVerifiedOrganizer && (
                      <Link href="/organizer/events/new" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/events/new')}>Create Event</Link>
                    )}
                    <Link href="/organizer/payouts" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/analytics')}>Analytics</Link>
                    <Link href="/organizer/payouts" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/payouts')}>Payouts</Link>
                    <Link href="/account/security" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/account/security')}>Security</Link>
                  </>
                )}

                {(userRole === 'attendee' || userRole === 'organizer' || userRole === 'admin') && (
                  <>
                    <div className="h-px bg-slate-800 my-2 mx-1" />
                    <Link href="/attendee/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/attendee/dashboard')}>My Tickets</Link>
                    <Link href="/favorites" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/favorites')}>Saved</Link>
                    <Link href="/inbox" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/inbox')}>Inbox</Link>
                  </>
                )}

                <div className="h-px bg-slate-800 my-2 mx-1" />
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium text-red-300/90 hover:bg-red-950/40 border border-transparent hover:border-red-900/40 transition text-left"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/')}>Events</Link>
                <Link href="/signup?role=attendee" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/signup?role=attendee')}>Get Ticket</Link>
                <Link href="/signup?role=organizer" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/signup?role=organizer')}>Sell Tickets</Link>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/login')}>Sign in</Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-3 block w-full text-center bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white px-4 py-3 rounded-xl font-bold transition shadow-lg shadow-indigo-950/40"
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}



