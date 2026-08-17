'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function FavoriteButton({
  eventId,
  initialFavorited = false,
  size = 'md',
}: {
  eventId: string;
  initialFavorited?: boolean;
  size?: 'sm' | 'md';
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const dim = size === 'sm' ? 18 : 22;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      if (res.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        console.error(data.error);
        return;
      }
      setFavorited(!!data.favorited);
      router.refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={favorited ? 'Remove from saved' : 'Save event'}
      title={favorited ? 'Saved — click to remove' : 'Save to wishlist'}
      className="inline-flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 border border-white/10 transition disabled:opacity-50"
      style={{ width: dim + 14, height: dim + 14 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={dim}
        height={dim}
        fill={favorited ? '#f43f5e' : 'none'}
        stroke={favorited ? '#f43f5e' : '#e2e8f0'}
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
    </button>
  );
}