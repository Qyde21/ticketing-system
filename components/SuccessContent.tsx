'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import EventTicket from '@/components/EventTicket';

type TicketInfo = {
  ticketCode: string;
  holderName?: string | null;
  status?: string;
  checkedInAt?: string | null;
  ticketTypeName?: string;
  eventTitle?: string;
  venueName?: string;
  startAt?: string;
  endAt?: string;
  coverImageUrl?: string | null;
  qrDataUrl?: string;
};

export default function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [tickets, setTickets] = useState<TicketInfo[]>([]);
  const [eventTitle, setEventTitle] = useState('');

  const load = useCallback(async () => {
    if (!reference) {
      setError('Missing payment reference.');
      setLoading(false);
      return true;
    }

    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(reference)}/status`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load order');
        setLoading(false);
        return true;
      }

      setStatus(data.status || '');
      setEventTitle(data.event?.title || '');

      if (data.status === 'paid' && Array.isArray(data.tickets) && data.tickets.length > 0) {
        const QRCode = (await import('qrcode')).default;
        const withQr: TicketInfo[] = [];
        for (const t of data.tickets) {
          const qrDataUrl = await QRCode.toDataURL(String(t.ticketCode), {
            margin: 1,
            width: 280,
            color: { dark: '#000000', light: '#ffffff' },
          });
          withQr.push({ ...t, qrDataUrl });
        }
        setTickets(withQr);
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch {
      setError('Network error loading tickets');
      setLoading(false);
      return true;
    }
  }, [reference]);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    async function poll() {
      const done = await load();
      if (cancelled || done) return;
      tries += 1;
      if (tries < 15) setTimeout(poll, 2000);
    }

    void poll();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (!reference) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center text-white">
        <p className="text-red-400">Missing payment reference.</p>
        <Link href="/" className="text-indigo-400 hover:underline mt-4 inline-block">Back home</Link>
      </div>
    );
  }

  if (loading && tickets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-white">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-400 border-t-transparent mb-4" />
        <p className="text-gray-400">Confirming payment and preparing your tickets…</p>
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center text-white">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/" className="text-indigo-400 hover:underline">Back home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] w-full px-3 sm:px-6 py-8 sm:py-12 text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center sm:text-left">
          <p className="text-emerald-400 text-sm font-bold uppercase tracking-wider mb-1">Payment successful</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
            Your tickets are ready
          </h1>
          {eventTitle && <p className="text-gray-400 text-sm mt-2">{eventTitle}</p>}
          <p className="text-gray-500 text-xs mt-1">
            Save this page or open each ticket link. Show QR or barcode at the door.
          </p>
        </div>

        {tickets.length === 0 && status === 'paid' && (
          <p className="text-amber-300 text-sm">Payment received — tickets are still being issued. Refresh in a moment.</p>
        )}

        <div className="space-y-8">
          {tickets.map((t) =>
            t.qrDataUrl ? (
              <div key={t.ticketCode} className="space-y-2">
                <EventTicket
                  eventTitle={t.eventTitle || eventTitle || 'Event'}
                  ticketTypeName={t.ticketTypeName}
                  venueName={t.venueName}
                  startAt={t.startAt}
                  endAt={t.endAt}
                  holderName={t.holderName}
                  ticketCode={t.ticketCode}
                  qrDataUrl={t.qrDataUrl}
                  status={t.status}
                  checkedInAt={t.checkedInAt}
                  coverImageUrl={t.coverImageUrl}
                />
                <div className="text-center">
                  <Link href={`/tickets/${t.ticketCode}`} className="text-sm text-indigo-400 hover:text-cyan-400 font-semibold">
                    Open full ticket page →
                  </Link>
                </div>
              </div>
            ) : null
          )}
        </div>

        <div className="flex flex-wrap gap-3 justify-center sm:justify-start pt-4">
          <Link href="/attendee/dashboard" className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition">
            My Tickets
          </Link>
          <Link href="/" className="bg-gray-800 hover:bg-gray-700 text-white font-semibold px-5 py-2.5 rounded-xl text-sm transition">
            Browse events
          </Link>
        </div>
      </div>
    </div>
  );
}
