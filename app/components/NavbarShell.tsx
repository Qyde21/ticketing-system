'use client';

import React from 'react';
import Link from 'next/link';

interface NavbarShellProps {
  userEmail?: string;
  userRole?: string;
  dashboardHref?: string;
}

export default function NavbarShell({ userEmail, userRole, dashboardHref }: NavbarShellProps) {
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (err) {
      console.error(err);
    }
  };

  const isLoggedIn = !!userEmail;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left Side: Green TH Badge + TicketHub Logo */}
        <Link href="/" className="flex items-center gap-2 text-lg font-bold hover:opacity-90 transition">
          <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-sm font-black">
            TH
          </span>
          <span className="text-white font-extrabold text-xl">TicketHub</span>
        </Link>

        {/* Right Side: Navigation Links */}
        <nav className="flex items-center gap-6 text-sm font-medium">
          {isLoggedIn ? (
            <>
              <Link href="/" className="text-slate-300 hover:text-white transition">Events</Link>
              
              {userRole === 'admin' && (
                <>
                  <Link href="/admin/dashboard" className="text-slate-300 hover:text-white transition">Admin</Link>
                  <Link href="/admin/organizers" className="text-slate-300 hover:text-white transition">Organizers</Link>
                  <Link href="/admin/events" className="text-slate-300 hover:text-white transition">All Events</Link>
                  <Link href="/admin/payouts" className="text-slate-300 hover:text-white transition">Payouts</Link>
                </>
              )}

              {userRole === 'organizer' && (
                <>
                  <Link href="/organizer/dashboard" className="text-slate-300 hover:text-white transition">Dashboard</Link>
                  <Link href="/organizer/payouts" className="text-slate-300 hover:text-white transition">Payouts</Link>
                </>
              )}

              {userRole === 'attendee' && (
                <Link href="/attendee/dashboard" className="text-slate-300 hover:text-white transition">My Tickets</Link>
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
              <Link href="/login" className="text-slate-300 hover:text-white transition">Sign in</Link>
              <Link href="/signup" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-md font-medium transition">
                Get Started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
