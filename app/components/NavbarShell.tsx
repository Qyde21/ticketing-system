'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavbarShellProps {
  userEmail?: string;
  userRole?: string;
  dashboardHref?: string;
}

export default function NavbarShell({ userEmail, userRole }: NavbarShellProps) {
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

  const isActive = (path: string) => pathname === path;

  const getLinkClass = (path: string) =>
    `transition py-1 ${
      isActive(path)
        ? 'text-emerald-400 font-semibold border-b-2 border-emerald-500'
        : 'text-slate-300 hover:text-white'
    }`;

  const getMobileLinkClass = (path: string) =>
    `block py-2 text-base font-medium transition ${
      isActive(path) ? 'text-emerald-400 font-bold' : 'text-slate-300 hover:text-white'
    }`;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Left Side: Logo */}
        <Link href="/" className="flex items-center gap-2 text-lg font-bold hover:opacity-90 transition shrink-0">
          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-sm font-black">
            TH
          </span>
          <span className="text-white font-extrabold text-lg sm:text-xl tracking-tight">TicketHub</span>
        </Link>

        {/* Desktop Navigation Links */}
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
                </>
              )}

              {userRole === 'organizer' && (
                <>
                  <Link href="/organizer/dashboard" className={getLinkClass('/organizer/dashboard')}>Dashboard</Link>
                  <Link href="/organizer/payouts" className={getLinkClass('/organizer/payouts')}>Payouts</Link>
                </>
              )}

              {userRole === 'attendee' && (
                <Link href="/attendee/dashboard" className={getLinkClass('/attendee/dashboard')}>My Tickets</Link>
              )}

              <button 
                onClick={handleLogout} 
                className="text-slate-300 hover:text-white transition cursor-pointer"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/" className={getLinkClass('/')}>Events</Link>
              <Link href="/signup?role=attendee" className={getLinkClass('/signup?role=attendee')}>Get Ticket</Link>
              <Link href="/signup?role=organizer" className={getLinkClass('/signup?role=organizer')}>Sell Tickets</Link>
              <Link href="/login" className={getLinkClass('/login')}>Sign in</Link>
              <Link href="/signup" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-medium transition shadow-sm">
                Get Started
              </Link>
            </>
          )}
        </nav>

        {/* Mobile Hamburger Button */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-slate-300 hover:text-white focus:outline-none p-2"
            aria-label="Toggle navigation menu"
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

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-6 space-y-2">
          {isLoggedIn ? (
            <>
              <Link href="/" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/')}>Events</Link>
              
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
                  <Link href="/organizer/payouts" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/payouts')}>Payouts</Link>
                </>
              )}

              {userRole === 'attendee' && (
                <Link href="/attendee/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/attendee/dashboard')}>My Tickets</Link>
              )}

              <button 
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }} 
                className="w-full text-left py-2 text-base font-medium text-slate-300 hover:text-white transition"
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
              <Link href="/signup" onClick={() => setMobileMenuOpen(false)} className="block w-full text-center bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-md font-medium transition mt-2">
                Get Started
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
