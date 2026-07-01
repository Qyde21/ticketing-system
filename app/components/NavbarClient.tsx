'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NavbarClient({ userName }: { userName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
    router.refresh();
    setLoading(false);
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-neutral-400 text-xs hidden sm:block truncate max-w-[140px]">{userName}</span>
      <button
        onClick={handleLogout}
        disabled={loading}
        className="text-neutral-300 hover:text-white transition-colors text-sm"
      >
        {loading ? 'Logging out...' : 'Log out'}
      </button>
    </div>
  );
}
