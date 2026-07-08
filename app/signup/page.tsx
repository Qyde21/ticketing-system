'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function SignupForm() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get('role') === 'organizer' ? 'organizer' : 'attendee';

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState(initialRole);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, password, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Signup failed');
      return;
    }
    router.push('/');
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 320, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>Sign up</h1>
      <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8, boxSizing: 'border-box' }} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8, boxSizing: 'border-box' }} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8, boxSizing: 'border-box' }} />
      <select value={role} onChange={(e) => setRole(e.target.value)} style={{ display: 'block', width: '100%', marginBottom: 8, padding: 8, boxSizing: 'border-box' }}>
        <option value="attendee">Attendee</option>
        <option value="organizer">Organizer</option>
      </select>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit" style={{ width: '100%', padding: 10, background: '#6366f1', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer' }}>Sign up</button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ margin: '4rem auto', textAlign: 'center' }}>Loading...</div>}>
      <SignupForm />
    </Suspense>
  );
}