'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/PasswordInput';

const inputClass = 'w-full bg-neutral-100 border border-black/15 rounded-lg px-4 py-3 text-black placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium text-center">
        This reset link is missing a token. Please request a new one from the{' '}
        <Link href="/forgot-password" className="underline font-semibold">forgot password page</Link>.
      </div>
    );
  }

  if (success) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium text-center">
        Password reset successfully! Redirecting you to log in...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-medium">
          {error}
        </div>
      )}

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">New Password</label>
        <PasswordInput
          value={password}
          onChange={setPassword}
          required
          placeholder="At least 8 characters"
          className={inputClass}
          autoComplete="new-password"
        />
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Confirm New Password</label>
        <PasswordInput
          value={confirmPassword}
          onChange={setConfirmPassword}
          required
          placeholder="Re-enter your new password"
          className={inputClass}
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full font-bold py-3 px-4 rounded-full transition disabled:opacity-50 bg-black text-white hover:bg-neutral-800"
      >
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="max-w-md mx-auto px-4 py-16 text-black">
      <div className="bg-white border border-black/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-black">Reset Password</h1>
          <p className="text-neutral-500 text-sm mt-2">Choose a new password for your account</p>
        </div>
        <Suspense fallback={<div className="text-center text-neutral-500">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
