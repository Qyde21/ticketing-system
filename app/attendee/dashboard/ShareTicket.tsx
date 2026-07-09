'use client';
import { useState } from 'react';

export default function ShareTicket({ code, eventTitle }: { code: string; eventTitle: string }) {
  const [copied, setCopied] = useState(false);
  const ticketUrl = 'https://ticketing-system-phi-eight.vercel.app/tickets/' + code;
  const waMessage = 'Here is your ticket for ' + eventTitle + ': ' + ticketUrl;
  const waHref = 'https://wa.me/?text=' + encodeURIComponent(waMessage);

  async function handleCopy() {
    await navigator.clipboard.writeText(ticketUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <button onClick={handleCopy} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #e5e7eb', background: copied ? '#d4edda' : '#fff', color: copied ? '#155724' : '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, border: '1px solid #25D366', background: '#25D366', color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap' }}>
        Share
      </a>
    </div>
  );
}