'use client';
import { useState } from 'react';

export default function ShareTicket({ code, eventTitle }: { code: string; eventTitle: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const ticketUrl = origin + '/tickets/' + code;
  const waMessage = 'Here is your ticket for ' + eventTitle + ': ' + ticketUrl;
  const waHref = 'https://wa.me/?text=' + encodeURIComponent(waMessage);

  async function handleCopy() {
    await navigator.clipboard.writeText(ticketUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex gap-1.5">
      <button
        onClick={handleCopy}
        className={
          'text-xs px-2 py-1 rounded border whitespace-nowrap transition ' +
          (copied
            ? 'bg-green-900/40 border-green-700 text-green-300'
            : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700')
        }
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-2 py-1 rounded whitespace-nowrap text-white"
        style={{ background: '#25D366' }}
      >
        Share
      </a>
    </div>
  );
}
