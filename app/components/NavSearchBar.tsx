"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NavSearchBar({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    onClose();
  };

  return (
    <div className="border-t border-black/10 bg-white">
      <form onSubmit={submit} role="search" className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3 rounded-full border border-black/10 bg-neutral-100 px-5 py-2.5 transition focus-within:border-black/40">
          <svg className="h-5 w-5 shrink-0 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
          </svg>
          <input
            ref={inputRef}
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search events, venues, cities, organizers..."
            aria-label="Search events"
            className="flex-1 bg-transparent text-[15px] text-black placeholder-neutral-500 outline-none"
          />
          <button type="submit" className="rounded-full bg-black px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-neutral-800">
            Search
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-semibold text-neutral-500 transition hover:text-black"
            aria-label="Close search"
          >
            Close
          </button>
        </div>
      </form>
    </div>
  );
}
