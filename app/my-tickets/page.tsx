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
      <div className="w-full max-w-md bg-white/90 border border-black/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
        <h1 className="text-2xl font-extrabold text-black text-center">My tickets</h1>
        <p className="text-neutral-500 text-sm text-center mt-2 mb-6">
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
            className="w-full bg-neutral-100/80 border border-black/15 rounded-xl px-4 py-3.5 text-black placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/60"
          />
          {err && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{err}</div>
          )}
          {msg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm">{msg}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full disabled:opacity-50 font-bold py-3.5 rounded-full bg-black text-white hover:bg-neutral-800"
          >
            {loading ? 'Sending…' : 'Email me a link'}
          </button>
        </form>
        <p className="text-center text-sm text-neutral-500 mt-6">
          Have an account?{' '}
          <Link href="/login" className="text-indigo-400 hover:text-cyan-400 font-semibold">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
