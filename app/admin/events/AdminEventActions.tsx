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
      alert('An error occurred');
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
            color: '#dc2626', 
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
    </div>
  );
}
