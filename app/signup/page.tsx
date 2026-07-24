'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import PasswordInput from '@/components/PasswordInput';

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const [role, setRole] = useState<'attendee' | 'organizer'>('attendee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
        body: JSON.stringify({ email, password, name, role }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Signup failed');
      }

      if (role === 'organizer') {
        router.push('/organizer/dashboard');
      } else {
        router.push('/attendee/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Link href="/" className="flex items-center gap-2 text-2xl font-bold">
            <span className="bg-emerald-600 text-white px-2.5 py-1 rounded text-base font-black">TH</span>
            <span className="text-white font-extrabold tracking-tight">TicketHub</span>
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
