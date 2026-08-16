'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function CheckoutCallbackInner() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref');
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed' | 'not_found'>('pending');
  const [ticketCodes, setTicketCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!reference) return;
    let cancelled = false;

    async function poll() {
      const res = await fetch(`/api/orders/${reference}/status`);
      if (!res.ok) {
        if (!cancelled) setStatus('not_found');
        return;
      }
      const data = await res.json();
      if (cancelled) return;

      if (data.status === 'paid') {
        setStatus('paid');
        setTicketCodes(data.ticketCodes);
      } else {
        setTimeout(poll, 2000);
      }
    }

    poll();
    return () => { cancelled = true; };
  }, [reference]);

  if (!reference) return <p style={{ margin: '2rem' }}>Missing payment reference.</p>;

  return (
    <div style={{ maxWidth: 500, margin: '2rem auto' }}>
      {status === 'pending' && <p>Confirming your payment, please wait...</p>}
      {status === 'not_found' && <p>We couldn&apos;t find that order.</p>}
      {status === 'paid' && (
        <div>
          <h1>Payment successful!</h1>
          <p>Your ticket{ticketCodes.length > 1 ? 's' : ''}:</p>
          <ul>
            {ticketCodes.map((code, idx) => (
              <li key={code}>
                <Link href={`/tickets/${code}`}>View Ticket #{idx + 1}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
