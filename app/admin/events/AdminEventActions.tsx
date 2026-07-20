'use client';

interface AdminEventActionsProps {
  eventId: string;
  status: string;
}

export default function AdminEventActions({ eventId, status }: AdminEventActionsProps) {
  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this event?')) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}/cancel`, { method: 'POST' });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to cancel event');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while cancelling');
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you SURE you want to permanently delete this event? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { method: 'DELETE' });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to delete event');
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while deleting');
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {status !== 'cancelled' ? (
        <button
          onClick={handleCancel}
          style={{
            background: 'none',
            border: 'none',
            color: '#eab308',
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 8px'
          }}
        >
          Cancel event
        </button>
      ) : (
        <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Cancelled</span>
      )}

      <button
        onClick={handleDelete}
        style={{
          background: 'rgba(220, 38, 38, 0.1)',
          border: '1px solid #dc2626',
          borderRadius: 4,
          color: '#dc2626',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          padding: '4px 8px'
        }}
      >
        Delete event
      </button>
    </div>
  );
}
