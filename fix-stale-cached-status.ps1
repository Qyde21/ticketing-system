# Run this from your project root
# Usage: powershell -ExecutionPolicy Bypass -File fix-stale-cached-status.ps1
#
# Root cause of "unscanned tickets from ended events still shows active":
# app/tickets/[code]/page.tsx was missing "export const dynamic =
# 'force-dynamic'". Without it, Next.js can cache the rendered page after
# the first view and never re-check whether the event has since ended -
# so anyone who looked at their ticket before the event ended kept seeing
# a stale "valid" page indefinitely, even though the actual expiry logic
# (getTicketDisplayStatus) was already correct. The other two ticket
# display pages already had this directive; this one didn't.
#
# Also found and fixed the same missing directive on the admin per-event
# analytics page, which could otherwise show stale revenue/sales numbers.
#
# Both files are patched minimally against their CURRENT content (Claude
# Code's latest versions) - only the missing line is added, nothing else
# is touched or overwritten.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Write-Host "1. Patching app/tickets/[code]/page.tsx ..." -ForegroundColor Cyan
$ticketContent = @'
import { sql } from '@/lib/db';
import QRCode from 'qrcode';
import EventTicket from '@/components/EventTicket';
import AddToCalendarButton from '@/components/AddToCalendarButton';
import { getTicketDisplayStatus } from '@/lib/tickets';

export const dynamic = 'force-dynamic';

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [ticket] = await sql`
    SELECT t.ticket_code, t.holder_name, t.status, t.checked_in_at,
           tt.name AS ticket_type_name,
           e.title AS event_title, e.venue_name, e.start_at, e.end_at, e.status AS event_status,
           e.cover_image_url
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
  const displayStatus = getTicketDisplayStatus(ticket.status, {
    status: ticket.event_status,
    start_at: ticket.start_at,
    end_at: ticket.end_at,
  });
  const isExpired = displayStatus === 'expired';

  return (
    <div className="min-h-[70vh] w-full px-3 sm:px-6 py-6 sm:py-10 text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center sm:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-300/80 mb-1">Your ticket</p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white leading-tight">{ticket.event_title}</h1>
          <p className="text-sm text-gray-400 mt-1">Show this at the entrance — QR or barcode both work</p>
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
          isExpired={isExpired}
          checkedInAt={ticket.checked_in_at}
          coverImageUrl={ticket.cover_image_url}
        />

        <div className="flex flex-wrap items-center justify-center sm:justify-between gap-3 text-sm">
          <p className="text-gray-400">
            Status:{' '}
            <strong className={isUsed ? 'text-red-400' : isExpired ? 'text-gray-400' : 'text-emerald-400'}>
              {displayStatus}
            </strong>
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

'@
[System.IO.File]::WriteAllText("app\tickets\[code]\page.tsx", $ticketContent, $utf8NoBom)
Write-Host "   Done." -ForegroundColor Green

Write-Host "2. Patching app/admin/events/[id]/analytics/page.tsx ..." -ForegroundColor Cyan
$analyticsContent = @'
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import SalesTrendChart from "@/components/SalesTrendChart";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminEventAnalyticsPage({ params }: PageProps) {
  const session = await getSession();

  if (!session || session.role !== 'admin') {
    return <div className="max-w-5xl mx-auto px-4 py-8 text-white">Unauthorized access.</div>;
  }

  const { id } = await params;

  const events = await sql`SELECT * FROM events WHERE id::text = ${id} OR slug = ${id}`;
  const event = events[0];

  if (!event) {
    notFound();
  }

  const ticketTypes = await sql`
    SELECT id, name, price_kes, quantity_total, quantity_sold 
    FROM ticket_types 
    WHERE event_id = ${event.id}
  `;

  const orders = await sql`
    SELECT created_at, total_amount_kes, payment_status, quantity
    FROM orders
    WHERE event_id = ${event.id}
  `;

  let totalCapacity = 0;
  let totalSold = 0;
  let totalRevenue = 0;

  const processedTiers = ticketTypes.map((t: any) => {
    const total = Number(t.quantity_total) || 0;
    const sold = Number(t.quantity_sold) || 0;
    const remaining = Math.max(0, total - sold);
    const tierPrice = Number(t.price_kes || 0);
    
    totalCapacity += total;
    totalSold += sold;
    totalRevenue += sold * tierPrice;

    const percentageSold = total > 0 ? Math.round((sold / total) * 100) : 0;

    return {
      ...t,
      total,
      sold,
      remaining,
      tierPrice,
      percentageSold
    };
  });

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 text-white">
      <div className="mb-6 flex justify-between items-center">
        <Link href="/admin/dashboard" className="text-indigo-400 hover:underline">
          &larr; Back to Admin Dashboard
        </Link>
        <span className="bg-purple-950 border border-purple-800 text-purple-300 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
          Admin / Organizer View
        </span>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
          Analytics: {event.title}
        </h1>
        <p className="text-gray-400 text-sm mt-1">Real-time inventory and revenue tracking (Private View)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Total Revenue Generated</p>
          <p className="text-2xl font-bold text-cyan-400 mt-2">KES {totalRevenue.toLocaleString()}</p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Tickets Sold / Capacity</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">{totalSold} <span className="text-gray-500 text-lg">/ {totalCapacity}</span></p>
        </div>
        <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
          <p className="text-indigo-300 font-medium text-sm">Overall Sell-Through</p>
          <p className="text-2xl font-bold text-amber-400 mt-2">
            {totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0}%
          </p>
        </div>
      </div>

      <SalesTrendChart orders={orders as any} />

      <div className="bg-gray-900 p-6 rounded-lg border border-gray-800 shadow-lg">
        <h2 className="text-xl font-bold mb-4 text-indigo-300">Ticket Tier Breakdown</h2>
        {processedTiers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-sm">
                  <th className="py-3 px-4">Tier Name</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Total Capacity</th>
                  <th className="py-3 px-4">Sold</th>
                  <th className="py-3 px-4">Remaining</th>
                  <th className="py-3 px-4">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {processedTiers.map((tier: any) => (
                  <tr key={tier.id} className="hover:bg-gray-800/50">
                    <td className="py-3 px-4 font-semibold text-white">{tier.name}</td>
                    <td className="py-3 px-4 text-cyan-400">KES {tier.tierPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-300">{tier.total}</td>
                    <td className="py-3 px-4 text-emerald-400 font-semibold">{tier.sold}</td>
                    <td className="py-3 px-4 text-amber-400 font-semibold">{tier.remaining}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
                          <div 
                            className="bg-indigo-500 h-full" 
                            style={{ width: `${tier.percentageSold}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400">{tier.percentageSold}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-400">No ticket types found for this event.</p>
        )}
      </div>
    </main>
  );
}
'@
[System.IO.File]::WriteAllText("app\admin\events\[id]\analytics\page.tsx", $analyticsContent, $utf8NoBom)
Write-Host "   Done." -ForegroundColor Green

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "  git add ."
Write-Host "  git commit -m ""Fix: add missing force-dynamic to prevent stale cached ticket status"""
Write-Host "  git push origin main"
