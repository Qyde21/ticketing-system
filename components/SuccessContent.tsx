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
  const claim = searchParams.get('claim') || '';

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
      const statusUrl =
        '/api/orders/' +
        encodeURIComponent(reference) +
        '/status' +
        (claim ? '?claim=' + encodeURIComponent(claim) : '');

      const res = await fetch(statusUrl, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load order');
        setLoading(false);
        return true;
      }

      setStatus(data.status || '');
      setEventTitle(data.event?.title || '');

      if (data.ticketsLocked && data.message) {
        setError(data.message);
      }

      if (data.status === 'paid' && Array.isArray(data.tickets) && data.tickets.length > 0) {
        setTickets(data.tickets);
        setError('');
        setLoading(false);
        return true;
      }

      if (data.status === 'paid') {
        setLoading(false);
        return true;
      }

      setLoading(false);
      return false;
    } catch {
      setError('Could not load order details.');
      setLoading(false);
      return true;
    }
  }, [reference, claim]);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;

    async function poll() {
      const done = await load();
      if (cancelled || done) return;
      tries += 1;
      if (tries < 15) {
        setTimeout(poll, 2000);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center text-white">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-400 border-t-transparent mb-4"></div>
        <p className="text-gray-400">Confirming your payment...</p>
      </div>
    );
  }

  if (error && tickets.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16 px-4 text-center text-white">
        <p className="text-amber-300 mb-2">{status === 'paid' ? 'Payment successful' : 'Order'}</p>
        <p className="text-gray-300 mb-4">{error}</p>
        <Link href="/attendee/dashboard" className="text-indigo-400 hover:underline mr-4">
          My Tickets
        </Link>
        <Link href="/" className="text-indigo-400 hover:underline">
          Back home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 text-white">
      <h1 className="text-2xl font-extrabold mb-2">Payment successful</h1>
      <p className="text-gray-400 mb-6">{eventTitle || 'Your tickets are ready'}</p>

      <div className="space-y-8">
        {tickets.map((t) => (
          <div key={t.ticketCode} className="space-y-3">
            <EventTicket
              eventTitle={t.eventTitle || eventTitle || 'Event'}
              ticketTypeName={t.ticketTypeName}
              venueName={t.venueName}
              startAt={t.startAt}
              endAt={t.endAt}
              holderName={t.holderName}
              ticketCode={t.ticketCode}
              qrDataUrl={t.qrDataUrl || ''}
              status={t.status}
              checkedInAt={t.checkedInAt}
              coverImageUrl={t.coverImageUrl}
            />
            <div className="text-center">
              <Link
                href={'/tickets/' + t.ticketCode}
                className="text-sm text-indigo-400 hover:text-cyan-400 font-semibold"
              >
                Open full ticket page →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/attendee/dashboard" className="text-indigo-400 hover:underline">
          Go to My Tickets
        </Link>
      </div>
    </div>
  );
}
