'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ShareTicket({ code, eventTitle }: { code: string; eventTitle: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [marking, setMarking] = useState(false);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ticketUrl = origin + '/tickets/' + code;
  const waMessage = 'Here is your ticket for ' + eventTitle + ': ' + ticketUrl;
  const waHref = 'https://wa.me/?text=' + encodeURIComponent(waMessage);

  // Once the buyer has actually shared it (via either button), mark it
  // server-side so it drops off their own "My Tickets" list - same as a
  // transfer would. Refresh so the list updates without a full reload.
  async function markShared() {
    if (marking) return;
    setMarking(true);
    try {
      await fetch(`/api/tickets/${code}/share`, { method: 'POST' });
      setShared(true);
      router.refresh();
    } catch {
      // Non-fatal: the link was already copied/opened either way. It'll
      // just still show in their list until they try sharing again.
    } finally {
      setMarking(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(ticketUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    markShared();
  }

  if (shared) {
    return <span className="text-xs text-gray-500 whitespace-nowrap">Shared</span>;
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={handleCopy}
        className={`text-xs px-2 py-1 rounded border whitespace-nowrap transition ${
          copied
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'
        }`}
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={markShared}
        className="text-xs px-2 py-1 rounded border border-emerald-600 bg-emerald-600 text-white whitespace-nowrap hover:bg-emerald-500 transition"
      >
        Share
      </a>
    </div>
  );
}