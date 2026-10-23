"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import NavSearchBar from './NavSearchBar';

interface NavbarShellProps {
  userEmail?: string;
  userRole?: string;
  dashboardHref?: string;
  isVerifiedOrganizer?: boolean;
}

export default function NavbarShell({ userEmail, userRole, isVerifiedOrganizer }: NavbarShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
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
        ? 'text-black font-semibold border-b-2 border-black'
        : 'text-neutral-500 hover:text-black'
    }`;

  const getMobileLinkClass = (path: string) =>
    `flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium transition ${
      isActive(path)
        ? 'bg-black/5 text-black border border-black/15'
        : 'text-neutral-700 hover:bg-black/5 border border-transparent'
    }`;

  const roleLabel =
    userRole === 'admin' ? 'Admin' : userRole === 'organizer' ? 'Organizer' : userRole === 'attendee' ? 'Attendee' : '';

  return (
    <header className="bg-white/90 backdrop-blur-md border-b border-black/10 text-black sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition shrink-0" onClick={() => setMobileMenuOpen(false)}>
          <img src="/logo-badge.png" alt="TicketHub" className="h-10 w-10 rounded-lg" />
          <span className="font-display text-2xl font-extrabold uppercase tracking-tight text-black">TicketHub</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => { setSearchOpen((v) => !v); setMobileMenuOpen(false); }}
            className="text-neutral-500 hover:text-black transition cursor-pointer"
            aria-label="Search events"
            aria-expanded={searchOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
          </button>
          {isLoggedIn ? (
            <>
              <Link href="/" className={getLinkClass('/')}>Events</Link>
              {userRole === 'admin' && (
                <>
                  <Link href="/admin/dashboard" className={getLinkClass('/admin/dashboard')}>Admin</Link>
                  <Link href="/admin/organizers" className={getLinkClass('/admin/organizers')}>Organizers</Link>
                  <Link href="/admin/events" className={getLinkClass('/admin/events')}>All Events</Link>
                  <Link href="/admin/orders" className={getLinkClass('/admin/orders')}>Orders</Link>
                  <Link href="/admin/audit" className={getLinkClass('/admin/audit')}>Audit</Link>
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
                  <Link href="/organizer/analytics" className={getLinkClass('/organizer/analytics')}>Analytics</Link>
                  <Link href="/organizer/payouts" className={getLinkClass('/organizer/payouts')}>Payouts</Link>
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
              <button onClick={handleLogout} className="text-neutral-500 hover:text-black transition cursor-pointer">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/" className={getLinkClass('/')}>Events</Link>
              <Link href="/signup?role=attendee" className={getLinkClass('/signup?role=attendee')}>Get Ticket</Link>
              <Link href="/signup?role=organizer" className={getLinkClass('/signup?role=organizer')}>Sell Tickets</Link>
              <Link href="/my-tickets" className={getLinkClass('/my-tickets')}>My tickets</Link>
              <Link href="/login" className={getLinkClass('/login')}>Sign in</Link>
              <Link href="/signup" className="bg-black hover:bg-neutral-800 text-white px-5 py-2 rounded-full font-semibold transition">
                Get Started
              </Link>
            </>
          )}
        </nav>

        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={() => { setSearchOpen((v) => !v); setMobileMenuOpen(false); }}
            className="text-black hover:text-neutral-600 focus:outline-none p-2 rounded-lg hover:bg-black/5"
            aria-label="Search events"
            aria-expanded={searchOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
            </svg>
          </button>

          <button
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setSearchOpen(false); }}
            className="text-black hover:text-neutral-600 focus:outline-none p-2 rounded-lg hover:bg-black/5"
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

      {searchOpen && <NavSearchBar onClose={() => setSearchOpen(false)} />}

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-black/10 bg-white">
          <div className="px-4 pt-4 pb-2">
            <div className="flex items-center gap-3 rounded-2xl bg-neutral-100 border border-black/10 p-3.5 mb-3">
              <img src="/logo-badge.png" alt="" className="h-11 w-11 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="font-display font-extrabold text-xl uppercase leading-tight text-black">TicketHub</p>
                {isLoggedIn ? (
                  <p className="text-xs text-neutral-500 truncate mt-0.5">
                    {roleLabel && <span className="text-black font-semibold">{roleLabel}</span>}
                    {roleLabel && userEmail ? ' · ' : ''}
                    {userEmail}
                  </p>
                ) : (
                  <p className="text-xs text-neutral-500 mt-0.5">Events & tickets in Kenya</p>
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
                    <Link href="/admin/orders" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/admin/orders')}>Orders</Link>
                    <Link href="/admin/audit" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/admin/audit')}>Audit</Link>
                    <Link href="/admin/payouts" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/admin/payouts')}>Payouts</Link>
                  </>
                )}

                {userRole === 'organizer' && (
                  <>
                    <Link href="/organizer/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/dashboard')}>Dashboard</Link>
                    {isVerifiedOrganizer && (
                      <Link href="/organizer/events/new" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/events/new')}>Create Event</Link>
                    )}
                    <Link href="/organizer/analytics" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/analytics')}>Analytics</Link>
                    <Link href="/organizer/payouts" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/payouts')}>Payouts</Link>
                    <Link href="/account/security" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/account/security')}>Security</Link>
                  </>
                )}

                {(userRole === 'attendee' || userRole === 'organizer' || userRole === 'admin') && (
                  <>
                    <div className="h-px bg-black/10 my-2 mx-1" />
                    <Link href="/attendee/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/attendee/dashboard')}>My Tickets</Link>
                    <Link href="/favorites" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/favorites')}>Saved</Link>
                    <Link href="/inbox" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/inbox')}>Inbox</Link>
                  </>
                )}

                <div className="h-px bg-black/10 my-2 mx-1" />
                <button
                  onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px] font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition text-left"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link href="/" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/')}>Events</Link>
                <Link href="/signup?role=attendee" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/signup?role=attendee')}>Get Ticket</Link>
                <Link href="/signup?role=organizer" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/signup?role=organizer')}>Sell Tickets</Link>
                <Link href="/my-tickets" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/my-tickets')}>My tickets</Link>
                <Link href="/login" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/login')}>Sign in</Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mt-3 block w-full text-center bg-black hover:bg-neutral-800 text-white px-4 py-3 rounded-full font-bold transition"
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

