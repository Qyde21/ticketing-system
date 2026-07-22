'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import TicketList from '@/components/TicketList';
import { useSearchParams } from 'next/navigation';

export default function SuccessContent() {
  const searchParams = useSearchParams();
  const reference = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('reference_code');

  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventTitle, setEventTitle] = useState("Your Event");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!reference) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchTickets = async () => {
      try {
        const res = await fetch(`/api/orders/${reference}/status`);
        if (!res.ok) {
          return false;
        }
        const data = await res.json();

        if (isMounted && data.status === 'paid' && data.tickets && data.tickets.length > 0) {
          setTickets(data.tickets);
          setEventTitle(data.tickets[0].event_title || data.tickets[0].eventTitle || "Event Ticket");
          setQuantity(data.tickets.length);
          setLoading(false);
          return true;
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
      return false;
    };

    fetchTickets().then((found) => {
      if (found) return;

      const interval = setInterval(async () => {
        const foundAgain = await fetchTickets();
        if (foundAgain) {
          clearInterval(interval);
        }
      }, 3000);

      const timeout = setTimeout(() => {
        clearInterval(interval);
        if (isMounted) setLoading(false);
      }, 30000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    });

    return () => {
      isMounted = false;
    };
  }, [reference]);

  if (!reference) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center text-white">
        <h1 className="text-3xl font-bold mb-4">No Reference Provided</h1>
        <p className="text-gray-400 mb-8">We could not find a payment reference in your request.</p>
        <Link href="/" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-white transition">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-white">
      <div className="bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-xl">
        <h1 className="text-3xl font-extrabold mb-2 text-center text-green-400">Payment Successful!</h1>
        <p className="text-gray-400 text-center mb-8">Your order has been verified and confirmed.</p>

        {loading && tickets.length === 0 ? (
          <div className="bg-yellow-950/40 border border-yellow-800/60 p-8 rounded-2xl text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-yellow-400 border-t-transparent"></div>
            <p className="text-yellow-200 font-medium">Generating your tickets and verifying payment...</p>
            <p className="text-xs text-gray-400 font-mono">Ref: {reference}</p>
          </div>
        ) : tickets.length > 0 ? (
          <TicketList tickets={tickets} eventTitle={eventTitle} quantity={quantity} />
        ) : (
          <div className="bg-yellow-950/40 border border-yellow-800/60 p-6 rounded-2xl text-center space-y-4">
            <p className="text-yellow-200">We are processing your ticket generation. If your tickets don't appear automatically, please click refresh.</p>
            <p className="text-xs text-gray-400 font-mono">Ref: {reference}</p>
            <Link
              href={`/success?reference=${reference}`}
              className="inline-block px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition"
            >
              Refresh
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
