# Run this from your project root: C:\Users\user\Desktop\ticketing-system
# Usage: powershell -ExecutionPolicy Bypass -File apply-new-logo.ps1
#
# Applies the new TicketHub branding everywhere the old emerald "TH" text
# badge appeared:
#   - Adds public/logo-icon.svg (the gold-on-indigo medallion mark)
#   - Navbar, footer, and both signup-page logo instances now use the
#     medallion + a two-tone serif wordmark
#   - Replaces app/icon.png, app/apple-icon.png, app/favicon.ico with the
#     same medallion mark, rasterized at the right sizes for browser tabs,
#     iOS home screen, etc. (Next.js picks these up automatically by
#     filename convention - no code changes needed for the favicon itself)

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

function Write-ClaudeFile($path, $content) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

function Write-ClaudeBinaryFile($path, $base64) {
    $dir = Split-Path $path -Parent
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $bytes = [Convert]::FromBase64String($base64)
    [System.IO.File]::WriteAllBytes($path, $bytes)
}

Write-Host "Writing: public\logo-icon.svg" -ForegroundColor Cyan
$content = @'
<svg width="300" height="300" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="titleB descB">
  <title id="titleB">TicketHub logo, concept B</title>
  <desc id="descB">A circular monogram medallion with the letters TH in gold serif type, deep indigo fill, and two subtle ticket-style notches cut into the outer edge.</desc>
  <defs>
    <mask id="notchMaskB">
      <rect x="0" y="0" width="300" height="300" fill="white"/>
      <circle cx="20" cy="150" r="14" fill="black"/>
      <circle cx="280" cy="150" r="14" fill="black"/>
    </mask>
  </defs>

  <circle cx="150" cy="150" r="130" fill="#1E1B4B" mask="url(#notchMaskB)"/>
  <circle cx="150" cy="150" r="118" fill="none" stroke="#C9A24B" stroke-width="1.5"/>

  <text x="150" y="190" font-family="Georgia, 'Times New Roman', serif" font-size="108" font-weight="700" fill="#C9A24B" text-anchor="middle" letter-spacing="-4">TH</text>
</svg>
'@
Write-ClaudeFile "public\logo-icon.svg" $content

Write-Host "Writing: app\components\NavbarShell.tsx" -ForegroundColor Cyan
$content = @'
'use client';

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
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition shrink-0">
          <img src="/logo-icon.svg" alt="TicketHub" className="h-9 w-9" />
          <span className="font-serif text-lg sm:text-xl font-bold tracking-tight">
            <span className="text-white">Ticket</span><span className="text-amber-400">Hub</span>
          </span>
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
                  <Link href="/account/security" className={getLinkClass('/account/security')}>Security</Link>
                </>
              )}

              {userRole === 'organizer' && (
                <>
                  <Link href="/organizer/dashboard" className={getLinkClass('/organizer/dashboard')}>Dashboard</Link>
                  {isVerifiedOrganizer && (
                    <Link href="/organizer/events/new" className={getLinkClass('/organizer/events/new')}>Create Event</Link>
                  )}
                  <Link href="/organizer/payouts" className={getLinkClass('/organizer/payouts')}>Payouts</Link>
                  <Link href="/account/security" className={getLinkClass('/account/security')}>Security</Link>
                </>
              )}

              {(userRole === 'attendee' || userRole === 'organizer' || userRole === 'admin') && (
                <>
                  <Link href="/attendee/dashboard" className={getLinkClass('/attendee/dashboard')}>My Tickets</Link>
                  <Link href="/inbox" className={getLinkClass('/inbox')}>Inbox</Link>
                </>
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
              <Link href="/my-tickets" className={getLinkClass('/my-tickets')}>My tickets</Link>
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
                  <Link href="/account/security" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/account/security')}>Security</Link>
                </>
              )}

              {userRole === 'organizer' && (
                <>
                  <Link href="/organizer/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/dashboard')}>Dashboard</Link>
                  {isVerifiedOrganizer && (
                    <Link href="/organizer/events/new" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/events/new')}>Create Event</Link>
                  )}
                  <Link href="/organizer/payouts" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/organizer/payouts')}>Payouts</Link>
                  <Link href="/account/security" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/account/security')}>Security</Link>
                </>
              )}

              {(userRole === 'attendee' || userRole === 'organizer' || userRole === 'admin') && (
                <>
                  <Link href="/attendee/dashboard" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/attendee/dashboard')}>My Tickets</Link>
                  <Link href="/inbox" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/inbox')}>Inbox</Link>
                </>
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
              <Link href="/my-tickets" onClick={() => setMobileMenuOpen(false)} className={getMobileLinkClass('/my-tickets')}>My tickets</Link>
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
'@
Write-ClaudeFile "app\components\NavbarShell.tsx" $content

Write-Host "Writing: app\components\Footer.tsx" -ForegroundColor Cyan
$content = @'
import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-300 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3">
              <img src="/logo-icon.svg" alt="TicketHub" className="h-8 w-8" />
              <span className="font-serif text-xl font-bold tracking-tight">
                <span className="text-white">Ticket</span><span className="text-amber-400">Hub</span>
              </span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Kenya's premier event ticketing platform. Buy and sell tickets for concerts, festivals, and live events.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white text-sm font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/" className="hover:text-white transition">Browse Events</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition">Sell Tickets</Link></li>
              <li><Link href="/my-tickets" className="hover:text-white transition">My Tickets</Link></li><li><Link href="/login" className="hover:text-white transition">Log In</Link></li>
              <li><Link href="/signup" className="hover:text-white transition">Sign Up</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white text-sm font-bold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/contact" className="hover:text-white transition">Contact Us</Link></li>
              <li><a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">WhatsApp Support</a></li>
              <li><Link href="/faq" className="hover:text-white transition">FAQ</Link></li>
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h4 className="text-white text-sm font-bold mb-4">Follow Us</h4>
            <div className="flex gap-4 text-sm text-slate-400">
              <a href="https://twitter.com/tickethubke" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Twitter/X</a>
              <a href="https://instagram.com/tickethubke" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Instagram</a>
              <a href="https://facebook.com/tickethubke" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Facebook</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <p>&copy; {new Date().getFullYear()} TicketHub Kenya. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
'@
Write-ClaudeFile "app\components\Footer.tsx" $content

Write-Host "Writing: app\signup\page.tsx" -ForegroundColor Cyan
$content = @'
'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import PasswordInput from '@/components/PasswordInput';

function SignupForm() {
  const searchParams = useSearchParams();
  
  const [role, setRole] = useState<'attendee' | 'organizer'>('attendee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam === 'organizer' || roleParam === 'attendee') {
      setRole(roleParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName: name, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      // Account is created but not yet usable — the API doesn't set a session
      // cookie until the emailed confirmation link is clicked. Show a
      // check-your-email screen instead of sending them to the dashboard.
      setSubmittedEmail(email);
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Link href="/" className="flex items-center justify-center gap-2.5 text-2xl font-bold mb-6">
            <img src="/logo-icon.svg" alt="TicketHub" className="h-9 w-9" />
            <span className="font-serif tracking-tight">
              <span className="text-white">Ticket</span><span className="text-amber-400">Hub</span>
            </span>
          </Link>
          <div className="bg-slate-900 py-8 px-6 shadow sm:rounded-lg border border-slate-800">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-900/50 border border-emerald-700 mb-4">
              <span className="text-2xl">✉️</span>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Check your email</h2>
            <p className="text-sm text-slate-400">
              We sent a confirmation link to <span className="text-white font-medium">{submittedEmail}</span>.
              Click the link to activate your account and get started.
            </p>
            <p className="text-xs text-slate-500 mt-4">
              Didn&apos;t get it? Check your spam folder, or{' '}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
                go to login
              </Link>{' '}
              to request a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2.5 text-2xl font-bold">
            <img src="/logo-icon.svg" alt="TicketHub" className="h-9 w-9" />
            <span className="font-serif tracking-tight">
              <span className="text-white">Ticket</span><span className="text-amber-400">Hub</span>
            </span>
          </Link>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-emerald-400 hover:text-emerald-300">
            Sign in
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-800">
          
          {/* Role Toggle Selector */}
          <div className="mb-6 flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              type="button"
              onClick={() => setRole('attendee')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${
                role === 'attendee'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Attendee (Buy Tickets)
            </button>
            <button
              type="button"
              onClick={() => setRole('organizer')}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition ${
                role === 'organizer'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Organizer (Sell Tickets)
            </button>
          </div>

          {role === 'attendee' && (
            <>
              <a
                href="/api/auth/google"
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold py-2.5 rounded-lg text-sm transition mb-5"
              >
                <svg width="18" height="18" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.6 34.7 26.9 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.6 39.6 16.3 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.4 36 44 30.5 44 24c0-1.3-.1-2.7-.4-3.5z"/>
                </svg>
                Continue with Google
              </a>
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-500 uppercase tracking-wider">or sign up with email</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 bg-red-900/50 border border-red-500/50 text-red-200 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-300">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                placeholder="Jane Doe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">Password</label>
              <PasswordInput
                value={password}
                onChange={setPassword}
                required
                placeholder="••••••••"
                className="mt-1 block w-full rounded-md bg-slate-950 border border-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 text-sm"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : `Sign Up as ${role === 'organizer' ? 'Organizer' : 'Attendee'}`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}
'@
Write-ClaudeFile "app\signup\page.tsx" $content

Write-Host "Writing: app\icon.png" -ForegroundColor Cyan
$b64_icon_png = "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"
Write-ClaudeBinaryFile "app\icon.png" $b64_icon_png

Write-Host "Writing: app\apple-icon.png" -ForegroundColor Cyan
$b64_apple_icon_png = "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"
Write-ClaudeBinaryFile "app\apple-icon.png" $b64_apple_icon_png

Write-Host "Writing: app\favicon.ico" -ForegroundColor Cyan
$b64_favicon_ico = "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"
Write-ClaudeBinaryFile "app\favicon.ico" $b64_favicon_ico

Write-Host ""
Write-Host "Done. Files updated:" -ForegroundColor Green
Write-Host "  - public\logo-icon.svg (new medallion mark)"
Write-Host "  - app\components\NavbarShell.tsx"
Write-Host "  - app\components\Footer.tsx"
Write-Host "  - app\signup\page.tsx (both logo instances)"
Write-Host "  - app\icon.png"
Write-Host "  - app\apple-icon.png"
Write-Host "  - app\favicon.ico"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  git add -A"
Write-Host "  git commit -m ""Apply new TicketHub logo across navbar, footer, and signup"""
Write-Host "  git push --force"
