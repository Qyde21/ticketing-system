'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || 'If an account with that email exists, we have sent a password reset link.');
      setSubmitted(true);
    } catch (err) {
      setMessage('Something went wrong. Please try again.');
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-16 text-black">
      <div className="bg-white border border-black/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-black">Forgot Password</h1>
          <p className="text-neutral-500 text-sm mt-2">Enter your email and we will send you a reset link</p>
        </div>

        {submitted ? (
          <div className="p-4 bg-indigo-950/60 border border-indigo-800/50 text-indigo-200 rounded-lg text-sm font-medium text-center">
            {message}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-indigo-300 mb-2">Email</label>
              <input
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-100 border border-black/15 rounded-lg px-4 py-3 text-black placeholder-neutral-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full font-bold py-3 px-4 rounded-full transition disabled:opacity-50 bg-black text-white hover:bg-neutral-800"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-sm text-neutral-500">
          Remembered your password?{' '}
          <Link href="/login" className="text-indigo-400 hover:underline font-semibold">
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}
