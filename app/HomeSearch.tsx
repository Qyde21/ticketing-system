'use client';
import { useState } from 'react';

export default function HomeSearch() {
  const [query, setQuery] = useState('');

  function handleChange(value: string) {
    setQuery(value);
    const q = value.toLowerCase().trim();
    document.querySelectorAll<HTMLElement>('.event-card').forEach((card) => {
      const title = card.dataset.title || '';
      card.style.display = title.includes(q) ? '' : 'none';
    });
  }

  return (
    <div className="bg-white rounded-xl shadow-md p-2 flex items-center gap-2 border border-neutral-100">
      <svg className="w-5 h-5 text-neutral-400 ml-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 105 11a6 6 0 0012 0z" />
      </svg>
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Search TicketHub events..."
        className="w-full py-2 outline-none text-neutral-800 placeholder:text-neutral-400"
      />
    </div>
  );
}