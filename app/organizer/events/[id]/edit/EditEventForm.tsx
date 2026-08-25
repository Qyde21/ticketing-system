'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from '../../new/ImageUpload';

interface TicketTypeInput {
  id?: string;
  name: string;
  priceKes: string;
  quantityTotal: string;
  quantitySold?: number;
  maxPerOrder?: number;
}

interface EventInput {
  id: string;
  title: string;
  description: string;
  category: string;
  venueName: string;
  venueAddress: string;
  startAt: string;
  endAt: string;
  coverImageUrl: string;
}

const inputClass =
  'w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gray-500';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2';

export default function EditEventForm({
  event,
  ticketTypes: initialTicketTypes,
  isAdminEditingOther,
  organizerLabel,
}: {
  event: EventInput;
  ticketTypes: TicketTypeInput[];
  isAdminEditingOther: boolean;
  organizerLabel: string;
}) {
  const router = useRouter();

  const [title, setTitle] = useState(event.title);
  const [coverImageUrl, setCoverImageUrl] = useState(event.coverImageUrl);
  const [description, setDescription] = useState(event.description);
  const [category, setCategory] = useState(event.category);
  const [venueName, setVenueName] = useState(event.venueName);
  const [venueAddress, setVenueAddress] = useState(event.venueAddress);
  const [startAt, setStartAt] = useState(event.startAt);
  const [endAt, setEndAt] = useState(event.endAt);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>(
    initialTicketTypes.length > 0 ? initialTicketTypes : [{ name: 'Regular', priceKes: '', quantityTotal: '' }]
  );
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function updateTicketType(index: number, field: 'name' | 'priceKes' | 'quantityTotal', value: string) {
    setTicketTypes((prev) => prev.map((tt, i) => (i === index ? { ...tt, [field]: value } : tt)));
  }

  function addTicketType() {
    setTicketTypes((prev) => [...prev, { name: '', priceKes: '', quantityTotal: '' }]);
  }

  function removeTicketType(index: number) {
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);

    if (endAt && new Date(endAt) <= new Date(startAt)) {
      setError('End date must be after the start date');
      return;
    }
    for (const tt of ticketTypes) {
      if (Number(tt.priceKes) < 0) {
        setError(`Price for "${tt.name || 'ticket type'}" cannot be negative`);
        return;
      }
      if (!Number.isInteger(Number(tt.quantityTotal)) || Number(tt.quantityTotal) < 1) {
        setError(`Quantity for "${tt.name || 'ticket type'}" must be at least 1`);
        return;
      }
      if (tt.quantitySold != null && Number(tt.quantityTotal) < tt.quantitySold) {
        setError(`Quantity for "${tt.name}" can't be less than the ${tt.quantitySold} already sold`);
        return;
      }
    }

    setSubmitting(true);

    const res = await fetch(`/api/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        category,
        venueName,
        venueAddress,
        startAt,
        endAt: endAt || null,
        coverImageUrl,
        ticketTypes: ticketTypes.map((tt) => ({
          id: tt.id,
          name: tt.name,
          priceKes: Number(tt.priceKes),
          quantityTotal: Number(tt.quantityTotal),
          maxPerOrder: tt.maxPerOrder,
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Failed to save changes');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto py-12 px-4 text-white space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          Edit Event
        </h1>
        <a href="/organizer/dashboard" className="text-indigo-400 hover:text-cyan-400 text-sm">
          &larr; Back to dashboard
        </a>
      </div>

      {isAdminEditingOther && (
        <p className="text-amber-400 text-sm bg-amber-950/30 border border-amber-800/40 rounded-xl px-4 py-3">
          You&apos;re editing this event as an admin on behalf of <strong>{organizerLabel}</strong>. This change will be recorded in the audit log.
        </p>
      )}

      <div>
        <label className={labelClass}>Event title</label>
        <input className={inputClass} placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        {coverImageUrl && (
          <img src={coverImageUrl} alt="Current cover" className="w-full max-h-52 object-cover rounded-xl mb-4" />
        )}
        <ImageUpload onUploaded={setCoverImageUrl} />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} rows={4} placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <label className={labelClass}>Category</label>
        <input className={inputClass} placeholder="Category (e.g. Concert, Festival)" value={category} onChange={(e) => setCategory(e.target.value)} />
      </div>

      <div>
        <label className={labelClass}>Venue name</label>
        <input className={inputClass} placeholder="Venue name" value={venueName} onChange={(e) => setVenueName(e.target.value)} required />
      </div>

      <div>
        <label className={labelClass}>Venue address</label>
        <input className={inputClass} placeholder="Venue address" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start date &amp; time</label>
          <input type="datetime-local" className={inputClass} value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass}>End date &amp; time (optional)</label>
          <input type="datetime-local" className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-white mb-3">Ticket Types</h2>
        <div className="space-y-3">
          {ticketTypes.map((tt, i) => (
            <div key={tt.id || i} className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <input className={inputClass} placeholder="Name (e.g. Regular)" value={tt.name} onChange={(e) => updateTicketType(i, 'name', e.target.value)} required />
                <input className={inputClass} placeholder="Price (KES)" type="number" min="0" value={tt.priceKes} onChange={(e) => updateTicketType(i, 'priceKes', e.target.value)} required />
                <input
                  className={inputClass}
                  placeholder="Quantity"
                  type="number"
                  min={tt.quantitySold || 1}
                  value={tt.quantityTotal}
                  onChange={(e) => updateTicketType(i, 'quantityTotal', e.target.value)}
                  required
                />
                {!tt.quantitySold && ticketTypes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTicketType(i)}
                    className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition whitespace-nowrap"
                  >
                    Remove
                  </button>
                )}
              </div>
              {!!tt.quantitySold && (
                <p className="text-xs text-gray-500 mt-2">
                  {tt.quantitySold} already sold — quantity can&apos;t go below this, and this tier can&apos;t be removed.
                </p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTicketType}
          className="mt-3 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition"
        >
          + Add ticket type
        </button>
      </div>

      {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
      {success && <p className="text-emerald-400 text-sm font-medium">Changes saved.</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 disabled:opacity-50"
      >
        {submitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
}
