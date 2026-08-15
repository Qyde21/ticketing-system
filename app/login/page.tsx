'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [pendingToken, setPendingToken] = useState('');
  const [code, setCode] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      if (data.twoFactorRequired) {
        setPendingToken(data.pendingToken);
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/2fa/verify-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingToken, code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        setLoading(false);
        return;
      }

      router.push('/');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  if (pendingToken) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/30">
            <div className="text-center mb-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white font-extrabold text-lg mb-4">
                T
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Two-factor code
              </h1>
              <p className="text-gray-400 text-sm mt-2">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 bg-red-950/80 border border-red-800/80 text-red-300 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <input
                type="text"
                required
                autoFocus
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition text-center tracking-[0.35em] text-lg font-semibold"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-lg shadow-indigo-950/40 disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify & log in'}
              </button>
            </form>

            <p className="text-xs text-gray-500 mt-4 text-center">
              Lost your device? Use one of your backup codes instead.
            </p>

            <button
              type="button"
              onClick={() => {
                setPendingToken('');
                setCode('');
                setError('');
              }}
              className="w-full mt-4 text-sm text-gray-400 hover:text-indigo-300 transition"
            >
              ← Back to login
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-gray-900/90 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-indigo-950/30">
          <div className="text-center mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white font-extrabold text-lg mb-4 shadow-lg shadow-indigo-900/40">
              T
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              Sign in to manage tickets and events
            </p>
          </div>

          <div className="flex rounded-xl bg-gray-800/80 p-1 mb-6 border border-gray-700/80">
            <span className="flex-1 text-center py-2.5 rounded-lg text-sm font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow">
              Login
            </span>
            <Link
              href="/signup"
              className="flex-1 text-center py-2.5 rounded-lg text-sm font-semibold text-gray-400 hover:text-white transition"
            >
              Sign up
            </Link>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-950/80 border border-red-800/80 text-red-300 rounded-xl text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300/90 mb-2">
                Email or username
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition"
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300/90">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-indigo-400 hover:text-cyan-400 font-semibold transition"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 z-10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <rect x="3" y="11" width="18" height="11" rx="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <PasswordInput
                  value={password}
                  onChange={setPassword}
                  required
                  placeholder="Your password"
                  className="w-full bg-gray-800/80 border border-gray-700 rounded-xl pl-11 pr-12 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 focus:ring-offset-gray-900"
              />
              <span className="text-sm text-gray-300">Keep me signed in for 30 days</span>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3.5 px-4 rounded-xl transition shadow-lg shadow-indigo-950/40 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Signing in…'
              ) : (
                <>
                  <span>Sign in</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-800 text-center text-sm text-gray-400">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-indigo-400 hover:text-cyan-400 font-semibold transition">
              Sign up
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
