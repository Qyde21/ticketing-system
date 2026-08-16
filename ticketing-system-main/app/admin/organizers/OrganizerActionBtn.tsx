'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OrganizerActionBtn({
  organizerId,
  currentStatus,
  isVerified,
}: {
  organizerId: string;
  currentStatus: string;
  isVerified: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
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

  const handleApprove = async () => {
    setApproving(true);
    try {
      const res = await fetch(`/api/admin/organizers/${organizerId}/approve`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to approve organizer');
      router.refresh();
    } catch (err) {
      alert('Error approving organizer');
    } finally {
      setApproving(false);
    }
  };

  const isSuspended = currentStatus === 'suspended';

  return (
    <div className="flex items-center gap-2">
      {!isVerified && (
        <button
          onClick={handleApprove}
          disabled={approving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-2 rounded-xl text-xs transition shadow-lg shadow-emerald-950/50 disabled:opacity-50"
        >
          {approving ? 'Approving...' : '✓ Approve Organizer'}
        </button>
      )}

      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 font-semibold px-3 py-2 rounded-xl text-xs transition"
        >
          Manage ?
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
    </div>
  );
}
