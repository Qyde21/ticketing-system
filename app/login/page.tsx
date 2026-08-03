'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

const VERIFY_ERROR_MESSAGES: Record<string, string> = {
  missing_token: 'That confirmation link looks incomplete. Try copying it again from your email.',
  expired: 'That confirmation link has expired or was already used. Enter your email below and request a new one.',
  not_found: 'We could not find an account for that confirmation link.',
  suspended: 'This account has been suspended. Contact support for help.',
};

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pendingToken, setPendingToken] = useState('');
  const [code, setCode] = useState('');
  const [showResend, setShowResend] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const verifyError = searchParams.get('verifyError');
    if (verifyError && VERIFY_ERROR_MESSAGES[verifyError]) {
      setError(VERIFY_ERROR_MESSAGES[verifyError]);
      setShowResend(verifyError === 'expired');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setShowResend(false);
    setResendMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setShowResend(Boolean(data.unverified));
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
    } catch (err) {
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
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    setResendMessage('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setResendMessage(data.message || 'If that account needs confirmation, we sent a new link.');
    } catch {
      setResendMessage('Something went wrong. Please try again.');
    } finally {
      setResending(false);
    }
  }

  if (pendingToken) {
    return (
      <main className="max-w-md mx-auto px-4 py-16 text-white">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Two-Factor Code</h1>
            <p className="text-gray-400 text-sm mt-2">Enter the 6-digit code from your authenticator app</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-lg text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleVerifyCode} className="space-y-5">
            <input
              type="text"
              required
              autoFocus
              inputMode="numeric"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition text-center tracking-widest text-lg"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition shadow-lg disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify & Log In'}
            </button>
          </form>

          <p className="text-xs text-gray-500 mt-4 text-center">
            Lost your device? Use one of your backup codes instead.
          </p>

          <button
            onClick={() => { setPendingToken(''); setCode(''); setError(''); }}
            className="w-full mt-4 text-sm text-gray-400 hover:text-gray-200"
          >
            &larr; Back to login
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-white">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">Welcome Back</h1>
          <p className="text-gray-400 text-sm mt-2">Log in to your TicketHub account</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/80 border border-red-800 text-red-300 rounded-lg text-sm font-medium">
            {error}
            {showResend && (
              <div className="mt-3">
                {resendMessage ? (
                  <p className="text-xs text-red-200">{resendMessage}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resending}
                    className="text-xs font-bold uppercase tracking-wider text-indigo-300 hover:text-indigo-200 underline disabled:opacity-50"
                  >
                    {resending ? 'Sending...' : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Username or Email</label>
            <input
              type="text"
              required
              placeholder="admin or name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300">Password</label>
              <Link href="/forgot-password" className="text-xs text-indigo-400 hover:underline font-semibold">
                Forgot password?
              </Link>
            </div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              required
              placeholder="••••••••"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold py-3 px-4 rounded-lg transition shadow-lg disabled:opacity-50"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link href="/signup" className="text-indigo-400 hover:underline font-semibold">
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
