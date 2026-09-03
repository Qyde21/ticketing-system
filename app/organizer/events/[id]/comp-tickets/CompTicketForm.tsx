'use client';
import { useState } from 'react';

interface TicketTypeInput {
  id: string;
  name: string;
  priceKes: number;
  remaining: number;
}

interface CompEntry {
  id: string;
  name: string;
  email: string;
  quantity: number;
  note: string | null;
  createdAt: string;
}

const inputClass =
  'w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gray-500';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2';

export default function CompTicketForm({
  eventId,
  eventTitle,
  eventStatus,
  ticketTypes,
  isAdminEditingOther,
  organizerLabel,
  recentComps,
}: {
  eventId: string;
  eventTitle: string;
  eventStatus: string;
  ticketTypes: TicketTypeInput[];
  isAdminEditingOther: boolean;
  organizerLabel: string;
  recentComps: CompEntry[];
}) {
  const [ticketTypeId, setTicketTypeId] = useState(ticketTypes[0]?.id || '');
  const [quantity, setQuantity] = useState('1');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedTier = ticketTypes.find((t) => t.id === ticketTypeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!ticketTypeId) {
      setError('Choose a ticket type');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1) {
      setError('Quantity must be at least 1');
      return;
    }
    if (selectedTier && qty > selectedTier.remaining) {
      setError(`Only ${selectedTier.remaining} left in this tier`);
      return;
    }

    setSubmitting(true);
    const res = await fetch(`/api/events/${eventId}/comp-tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketTypeId,
        quantity: qty,
        recipientName,
        recipientEmail,
        recipientPhone,
        note: note || undefined,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to issue ticket');
      setSubmitting(false);
      return;
    }

    setSuccess(`Issued ${qty} free ticket${qty > 1 ? 's' : ''} to ${recipientName}.`);
    setRecipientName('');
    setRecipientEmail('');
    setRecipientPhone('');
    setNote('');
    setQuantity('1');
    setSubmitting(false);
    // full reload so the "recently issued" list and remaining counts refresh
    setTimeout(() => window.location.reload(), 1200);
  }

  if (eventStatus === 'cancelled') {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-white">
        <p className="text-red-400">This event has been cancelled — complimentary tickets can&apos;t be issued.</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-12 px-4 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          Complimentary Tickets
        </h1>
        <p className="text-gray-400 text-sm mt-1">{eventTitle}</p>
        <a href={`/organizer/events/${eventId}/edit`} className="text-indigo-400 hover:text-cyan-400 text-sm">
          &larr; Back to event
        </a>
      </div>

      {isAdminEditingOther && (
        <p className="text-amber-400 text-sm bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3">
          You&apos;re issuing tickets as admin on behalf of <strong>{organizerLabel}</strong>. This will be recorded in the audit log.
        </p>
      )}

      {ticketTypes.length === 0 ? (
        <p className="text-gray-400 text-sm">This event has no ticket types yet — add one from the event editor first.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Ticket type</label>
            <select
              className={inputClass}
              value={ticketTypeId}
              onChange={(e) => setTicketTypeId(e.target.value)}
            >
              {ticketTypes.map((tt) => (
                <option key={tt.id} value={tt.id} disabled={tt.remaining === 0}>
                  {tt.name} — normally KES {tt.priceKes.toLocaleString()} — {tt.remaining} left
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Quantity</label>
            <input
              className={inputClass}
              type="number"
              min="1"
              max={selectedTier?.remaining || 1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Recipient name</label>
            <input className={inputClass} placeholder="Full name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required />
          </div>

          <div>
            <label className={labelClass}>Recipient email</label>
            <input className={inputClass} type="email" placeholder="email@example.com" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required />
          </div>

          <div>
            <label className={labelClass}>Recipient phone</label>
            <input className={inputClass} placeholder="07XX XXX XXX" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} required />
          </div>

          <div>
            <label className={labelClass}>Reason (optional, internal note only)</label>
            <input className={inputClass} placeholder="e.g. Press pass, sponsor, staff" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
          {success && <p className="text-emerald-400 text-sm font-medium">{success}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 disabled:opacity-50"
          >
            {submitting ? 'Issuing…' : 'Issue Free Ticket'}
          </button>
        </form>
      )}

      {recentComps.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-3">Recently Issued</h2>
          <div className="space-y-2">
            {recentComps.map((c) => (
              <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-sm">
                <div className="flex justify-between items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{c.name} · {c.quantity} ticket{c.quantity > 1 ? 's' : ''}</p>
                    <p className="text-gray-500 text-xs truncate">{c.email}</p>
                    {c.note && <p className="text-gray-400 text-xs mt-1">{c.note}</p>}
                  </div>
                  <span className="text-gray-500 text-xs flex-shrink-0">
                    {new Date(c.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
