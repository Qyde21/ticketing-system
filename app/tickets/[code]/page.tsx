import { sql } from '@/lib/db';
import QRCode from 'qrcode';
import EventTicket from '@/components/EventTicket';
import AddToCalendarButton from '@/components/AddToCalendarButton';

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [ticket] = await sql`
    SELECT t.ticket_code, t.holder_name, t.status, t.checked_in_at,
           tt.name AS ticket_type_name,
           e.title AS event_title, e.venue_name, e.start_at, e.end_at
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN orders o ON o.id = t.order_id
    JOIN events e ON e.id = o.event_id
    WHERE t.ticket_code = ${code}
  `;

  if (!ticket) {
    return (
      <div className="max-w-lg mx-auto py-16 px-4 text-center text-white">
        <p className="text-lg font-semibold">Ticket not found.</p>
      </div>
    );
  }

  const qrDataUrl = await QRCode.toDataURL(ticket.ticket_code, {
    margin: 1,
    width: 280,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const isUsed = ticket.status === 'used';

  return (
    <div className="min-h-[70vh] w-full px-3 sm:px-6 py-6 sm:py-10 text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-1">
            Your ticket
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">
            {ticket.event_title}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Show this at the entrance — QR or barcode both work
          </p>
        </div>

        <EventTicket
          eventTitle={ticket.event_title}
          ticketTypeName={ticket.ticket_type_name}
          venueName={ticket.venue_name}
          startAt={ticket.start_at}
          endAt={ticket.end_at}
          holderName={ticket.holder_name}
          ticketCode={ticket.ticket_code}
          qrDataUrl={qrDataUrl}
          status={ticket.status}
          checkedInAt={ticket.checked_in_at}
        />

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 text-sm">
          <p className="text-gray-400">
            Status:{' '}
            <strong className={isUsed ? 'text-red-400' : 'text-emerald-400'}>{ticket.status}</strong>
          </p>
          <AddToCalendarButton
            title={ticket.event_title}
            location={ticket.venue_name}
            startAt={ticket.start_at}
            endAt={ticket.end_at}
          />
        </div>
      </div>
    </div>
  );
}
