import { sql } from '@/lib/db';
import QRCode from 'qrcode';
import TicketQRReveal from '@/components/TicketQRReveal';

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [ticket] = await sql`
    SELECT t.ticket_code, t.holder_name, t.status, t.checked_in_at,
           tt.name AS ticket_type_name,
           e.title AS event_title, e.venue_name, e.start_at
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN orders o ON o.id = t.order_id
    JOIN events e ON e.id = o.event_id
    WHERE t.ticket_code = ${code}
  `;

  if (!ticket) {
    return <div style={{ maxWidth: 500, margin: '2rem auto' }}>Ticket not found.</div>;
  }

  const qrDataUrl = await QRCode.toDataURL(ticket.ticket_code);

  return (
    <div style={{ maxWidth: 400, margin: '2rem auto', textAlign: 'center' }}>
      <h1>{ticket.event_title}</h1>
      <p>{ticket.ticket_type_name}</p>
      <p>{ticket.venue_name} - {new Date(ticket.start_at).toLocaleString()}</p>
      <TicketQRReveal qrDataUrl={qrDataUrl} />
      <p>Status: {ticket.status}</p>
    </div>
  );
}
