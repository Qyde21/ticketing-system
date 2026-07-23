'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';

interface TicketTypeInput {
  name: string;
  priceKes: string;
  quantityTotal: string;
}

const inputClass =
  'w-full bg-gray-900 border border-gray-800 rounded-xl p-3 text-white text-sm focus:outline-none focus:border-indigo-500 placeholder:text-gray-500';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2';

export default function NewEventPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [venueName, setVenueName] = useState('');
  const [venueAddress, setVenueAddress] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>([
    { name: 'Regular', priceKes: '', quantityTotal: '' },
  ]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateTicketType(index: number, field: keyof TicketTypeInput, value: string) {
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
    }

    setSubmitting(true);

    const res = await fetch('/api/events', {
      method: 'POST',
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
        publishNow,
        ticketTypes: ticketTypes.map((tt) => ({
          name: tt.name,
          priceKes: Number(tt.priceKes),
          quantityTotal: Number(tt.quantityTotal),
        })),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'Failed to create event');
      setSubmitting(false);
      return;
    }

    router.push('/organizer/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto py-12 px-4 text-white space-y-6">
      <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
        Create Event
      </h1>

      <div>
        <label className={labelClass}>Event title</label>
        <input className={inputClass} placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
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
            <div key={i} className="flex flex-col sm:flex-row gap-2 bg-gray-900 border border-gray-800 rounded-xl p-3">
              <input className={inputClass} placeholder="Name (e.g. Regular)" value={tt.name} onChange={(e) => updateTicketType(i, 'name', e.target.value)} required />
              <input className={inputClass} placeholder="Price (KES)" type="number" min="0" value={tt.priceKes} onChange={(e) => updateTicketType(i, 'priceKes', e.target.value)} required />
              <input className={inputClass} placeholder="Quantity" type="number" min="1" value={tt.quantityTotal} onChange={(e) => updateTicketType(i, 'quantityTotal', e.target.value)} required />
              {ticketTypes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTicketType(i)}
                  className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-red-400 hover:text-red-300 transition whitespace-nowrap"
                >
                  Remove
                </button>
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

      <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer">
        <input type="checkbox" checked={publishNow} onChange={(e) => setPublishNow(e.target.checked)} />
        Publish immediately (otherwise this event is saved as a draft and won&apos;t be visible to buyers until you publish it)
      </label>

      {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition shadow-lg shadow-indigo-950/50 disabled:opacity-50"
      >
        {submitting ? 'Creating...' : 'Create Event'}
      </button>
    </form>
  );
}
