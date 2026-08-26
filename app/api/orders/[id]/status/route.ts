import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { verifyOrderClaim } from '@/lib/orderClaim';
import QRCode from 'qrcode';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: reference } = await params;
  if (!reference || reference.length > 80) {
    return NextResponse.json({ error: 'Invalid reference' }, { status: 400 });
  }

  const claim = req.nextUrl.searchParams.get('claim');
  const claimOk = await verifyOrderClaim(claim, reference);
  const session = await getSession();

  const orders = await sql`
    SELECT o.id, o.payment_status, o.buyer_name, o.buyer_email, o.quantity,
           e.title AS event_title, e.venue_name, e.start_at, e.end_at, e.cover_image_url
    FROM orders o
    JOIN events e ON e.id = o.event_id
    WHERE o.paystack_reference = ${reference}
  `;

  if (!orders.length) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const paid = orders.some((o: any) => o.payment_status === 'paid') ? 'paid' : orders[0].payment_status;
  const first = orders[0];
  const buyerEmail = String(first.buyer_email || '').trim().toLowerCase();
  const sessionEmail = session?.email ? String(session.email).trim().toLowerCase() : '';
  const emailOk = Boolean(sessionEmail && buyerEmail && sessionEmail === buyerEmail);
  const canSeeTickets = claimOk || emailOk;

  const publicEvent = {
    title: first.event_title,
    venueName: first.venue_name,
    startAt: first.start_at,
    endAt: first.end_at,
    coverImageUrl: first.cover_image_url,
  };

  if (!canSeeTickets) {
    return NextResponse.json({
      status: paid,
      ticketCodes: [],
      tickets: [],
      event: publicEvent,
      ticketsLocked: paid === 'paid',
      message:
        paid === 'paid'
          ? 'Payment confirmed. Open the link from your ticket email, or log in with the purchase email to view tickets.'
          : undefined,
    });
  }

  const orderIds = orders.map((o: any) => o.id);
  let ticketRows: any[] = [];
  if (paid === 'paid') {
    ticketRows = await sql`
      SELECT t.ticket_code, t.holder_name, t.status, t.checked_in_at,
             tt.name AS ticket_type_name,
             e.title AS event_title, e.venue_name, e.start_at, e.end_at, e.cover_image_url
      FROM tickets t
      JOIN ticket_types tt ON tt.id = t.ticket_type_id
      JOIN orders o ON o.id = t.order_id
      JOIN events e ON e.id = o.event_id
      WHERE t.order_id = ANY(${orderIds}::uuid[])
      ORDER BY t.ticket_code
    `;
  }

  const tickets = await Promise.all(
    ticketRows.map(async (t) => {
      let qrDataUrl = '';
      try {
        qrDataUrl = await QRCode.toDataURL(String(t.ticket_code), {
          margin: 1,
          width: 280,
          color: { dark: '#000000', light: '#ffffff' },
        });
      } catch {
        qrDataUrl = '';
      }
      return {
        ticketCode: t.ticket_code,
        holderName: t.holder_name,
        status: t.status,
        checkedInAt: t.checked_in_at,
        ticketTypeName: t.ticket_type_name,
        eventTitle: t.event_title,
        venueName: t.venue_name,
        startAt: t.start_at,
        endAt: t.end_at,
        coverImageUrl: t.cover_image_url,
        qrDataUrl,
      };
    })
  );

  return NextResponse.json({
    status: paid,
    ticketCodes: ticketRows.map((t) => t.ticket_code),
    tickets,
    event: publicEvent,
  });
}
