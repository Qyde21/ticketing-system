'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ReviewForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit() {
    if (rating < 1) {
      setError('Please pick a star rating first');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/events/${eventId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, comment }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitted(true);
        router.refresh();
      } else {
        setError(data.error || 'Failed to submit review');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 font-semibold px-4 py-3 rounded-xl">
        Thanks for your review!
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <p className="text-sm font-bold text-white mb-2">Leave a review</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoverRating(star)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill={(hoverRating || rating) >= star ? '#fbbf24' : 'none'}
              stroke="#fbbf24"
              strokeWidth={1.5}
              style={{ width: 26, height: 26 }}
            >
              <path d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L10 14.9l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L10 1.5z" />
            </svg>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Optional — share what you thought (max 2000 characters)"
        maxLength={2000}
        rows={3}
        className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-sm text-white mb-3 resize-none"
      />
      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold text-sm transition"
      >
        {loading ? 'Submitting…' : 'Submit review'}
      </button>
    </div>
  );
}
