'use client';
import { useState } from 'react';

export default function TransferTicketButton({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleTransfer() {
    if (!name.trim() || !email.trim()) {
      setError('Please enter a name and email');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/tickets/${code}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newHolderName: name, newHolderEmail: email }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Failed to transfer ticket');
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return <span className="text-xs text-emerald-400 font-semibold whitespace-nowrap">Transferred!</span>;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded border border-gray-700 bg-gray-800 hover:bg-gray-700 text-gray-300 whitespace-nowrap transition"
      >
        Transfer
      </button>
    );
  }

  return (
    <div className="w-full bg-gray-950 border border-gray-800 rounded-lg p-3 mt-2 flex flex-col gap-2">
      <p className="text-xs font-semibold text-gray-300">Transfer this ticket to:</p>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipient's full name"
        className="w-full bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Recipient's email"
        className="w-full bg-gray-900 border border-gray-800 rounded-md px-2.5 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleTransfer}
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-md transition"
        >
          {loading ? 'Transferring...' : 'Confirm Transfer'}
        </button>
        <button
          onClick={() => { setOpen(false); setError(''); }}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-md transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
