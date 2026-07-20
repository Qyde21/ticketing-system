'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ImageUpload from './ImageUpload';

interface TicketTypeInput {
  name: string;
  priceKes: string;
  quantityTotal: string;
}

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
  const [ticketTypes, setTicketTypes] = useState<TicketTypeInput[]>([
    { name: 'Regular', priceKes: '', quantityTotal: '' },
  ]);
  const [error, setError] = useState('');

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
      return;
    }

    router.push('/organizer/dashboard');
  }

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: 500, margin: '2rem auto' }}>
      <h1>Create Event</h1>

      <input placeholder="Event title" value={title} onChange={(e) => setTitle(e.target.value)} required />

      <ImageUpload onUploaded={setCoverImageUrl} />

      <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <input placeholder="Category (e.g. Concert, Festival)" value={category} onChange={(e) => setCategory(e.target.value)} />
      <input placeholder="Venue name" value={venueName} onChange={(e) => setVenueName(e.target.value)} required />
      <input placeholder="Venue address" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />

      <label>Start date &amp; time</label>
      <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />

      <label>End date &amp; time (optional)</label>
      <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} />

      <h2>Ticket Types</h2>
      {ticketTypes.map((tt, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input placeholder="Name (e.g. Regular)" value={tt.name} onChange={(e) => updateTicketType(i, 'name', e.target.value)} required />
          <input placeholder="Price (KES)" type="number" value={tt.priceKes} onChange={(e) => updateTicketType(i, 'priceKes', e.target.value)} required />
          <input placeholder="Quantity" type="number" value={tt.quantityTotal} onChange={(e) => updateTicketType(i, 'quantityTotal', e.target.value)} required />
          {ticketTypes.length > 1 && <button type="button" onClick={() => removeTicketType(i)}>Remove</button>}
        </div>
      ))}
      <button type="button" onClick={addTicketType}>+ Add ticket type</button>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button type="submit">Create Event</button>
    </form>
  );
}