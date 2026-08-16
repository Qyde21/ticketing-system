'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function MyTicketsRequestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    setErr('');
    try {
      const res = await fetch('/api/tickets/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.error || 'Request failed');
      else setMsg(data.message || 'Check your email for a secure link.');
    } catch {
      setErr('Network error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-gray-900/90 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <h1 className="text-2xl font-extrabold text-white text-center">My tickets</h1>
        <p className="text-gray-400 text-sm text-center mt-2 mb-6">
          Enter the email you used at checkout. We will send a secure link to view your tickets — no account needed.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          />
          {err && (
            <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 rounded-xl text-sm">{err}</div>
          )}
          {msg && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-800 text-emerald-300 rounded-xl text-sm">{msg}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl"
          >
            {loading ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-cyan-400 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
