'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OrganizerActionBtn({ organizerId, currentStatus }: { organizerId: string, currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleToggleStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizers/${organizerId}/toggle-status`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to update status');
      router.refresh();
    } catch (err) {
      alert('Error updating organizer status');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const isSuspended = currentStatus === 'suspended';

  return (
    <div className="relative">
      <button 
        onClick={() => setOpen(!open)}
        className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-semibold px-3 py-2 rounded-xl text-xs transition"
      >
        Manage ▾
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-40 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl py-1 z-20">
          <button
            onClick={handleToggleStatus}
            disabled={loading}
            className={`w-full text-left px-4 py-2 text-xs font-semibold transition ${
              isSuspended ? 'text-green-400 hover:bg-green-950/40' : 'text-red-400 hover:bg-red-950/40'
            }`}
          >
            {loading ? 'Processing...' : isSuspended ? 'Activate Account' : 'Suspend Organizer'}
          </button>
        </div>
      )}
    </div>
  );
}