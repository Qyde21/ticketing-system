# Run this from your project root
# Usage: powershell -ExecutionPolicy Bypass -File redesign-ticket-page-horizontal.ps1
#
# Full layout redesign matching the horizontal white/purple diagonal-cut
# reference: white details panel on the left (event name, venue, date,
# door time, and a new "Ticket Price" hero element), diagonal seam with
# perforation notches, purple gradient panel on the right holding status,
# holder name, and the QR/barcode (TicketQRReveal, untouched).
#
# Proportions are adapted for mobile — the reference is an ultra-wide
# desktop banner; this keeps the same visual identity but sized to fit a
# phone screen at the door without clipping or requiring zoom.
#
# Also adds ticket_types.price_kes to the query (new field, used for the
# price display) and wraps the QR/barcode area in a horizontal-scroll
# safety net so it can never get cut off on the smallest phones.

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding $false

Write-Host "Writing: app\tickets\[code]\page.tsx" -ForegroundColor Cyan
$content = @'
import { sql } from '@/lib/db';
import QRCode from 'qrcode';
import TicketQRReveal from '@/components/TicketQRReveal';
import AddToCalendarButton from '@/components/AddToCalendarButton';

export default async function TicketPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  const [ticket] = await sql`
    SELECT t.ticket_code, t.holder_name, t.status, t.checked_in_at,
           tt.name AS ticket_type_name, tt.price_kes,
           e.title AS event_title, e.venue_name, e.start_at, e.end_at, e.cover_image_url
    FROM tickets t
    JOIN ticket_types tt ON tt.id = t.ticket_type_id
    JOIN orders o ON o.id = t.order_id
    JOIN events e ON e.id = o.event_id
    WHERE t.ticket_code = ${code}
  `;

  if (!ticket) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <p className="text-gray-400">Ticket not found.</p>
      </div>
    );
  }

  const qrDataUrl = await QRCode.toDataURL(String(ticket.ticket_code));
  const isUsed = ticket.status === 'used';
  const eventEnd = ticket.end_at ? new Date(ticket.end_at) : new Date(ticket.start_at);
  const eventEnded = eventEnd < new Date();
  const isExpired = !isUsed && ticket.status === 'valid' && eventEnded;

  const statusLabel = isUsed ? 'Scanned' : isExpired ? 'Expired' : 'Valid';
  const statusClasses = isUsed
    ? 'bg-red-950/60 text-red-300 border-red-800'
    : isExpired
    ? 'bg-white/10 text-white/60 border-white/20'
    : 'bg-white/95 text-violet-800 border-white';

  const dateStr = new Date(ticket.start_at).toLocaleDateString('en-KE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = new Date(ticket.start_at).toLocaleTimeString('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
  });
  const price = ticket.price_kes !== null && ticket.price_kes !== undefined
    ? `KES ${Number(ticket.price_kes).toLocaleString()}`
    : 'Free';

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-3 py-10">
      <div className="w-full max-w-[380px]">
        <div className="relative flex rounded-3xl overflow-hidden shadow-2xl shadow-black/60 bg-white">
          {/* Left panel — event details */}
          <div className="relative z-0 flex-[0_0_40%] bg-white px-4 py-5 flex flex-col">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
              Admit One
            </p>
            <h1 className="mt-1.5 text-[17px] leading-tight font-extrabold text-gray-900">
              {ticket.event_title}
            </h1>
            <p className="mt-1 text-[11px] text-gray-500 truncate">{ticket.venue_name}</p>

            <div className="mt-4">
              <p className="text-[17px] font-extrabold text-gray-900 leading-none">{dateStr}</p>
              <p className="text-[11px] text-gray-500 mt-1">Door opens {timeStr}</p>
            </div>

            <div className="mt-auto pt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                Ticket Price
              </p>
              <p className="text-2xl font-extrabold text-gray-900 leading-none mt-1">{price}</p>
            </div>
          </div>

          {/* Diagonal seam with perforation */}
          <div className="relative z-10 w-0">
            <div className="absolute -left-2.5 -top-2.5 w-5 h-5 rotate-45 bg-gray-950" />
            <div className="absolute -left-2.5 -bottom-2.5 w-5 h-5 rotate-45 bg-gray-950" />
            <div className="absolute top-3 bottom-3 left-0 border-l-2 border-dashed border-white/70" />
          </div>

          {/* Right panel — status, holder, code */}
          <div
            className="relative flex-1 px-4 py-5 flex flex-col text-white"
            style={{
              clipPath: 'polygon(6% 0, 100% 0, 100% 100%, 0% 100%)',
              marginLeft: '-10px',
              paddingLeft: '22px',
              background: ticket.cover_image_url
                ? `linear-gradient(160deg, rgba(88,28,135,0.88), rgba(30,27,75,0.93)), url(${ticket.cover_image_url}) center/cover`
                : 'linear-gradient(160deg, #7e22ce 0%, #4c1d95 55%, #1e1b4b 100%)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
                {ticket.ticket_type_name}
              </span>
              <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full border ${statusClasses}`}>
                {statusLabel}
              </span>
            </div>

            {ticket.holder_name && (
              <p className="mt-2 text-sm font-semibold text-white/90 truncate">{ticket.holder_name}</p>
            )}

            <div className="mt-4 flex-1 flex items-center justify-center overflow-x-auto">
              {isUsed ? (
                <div className="text-center py-4">
                  <p className="font-bold text-white">Already scanned</p>
                  {ticket.checked_in_at && (
                    <p className="mt-1 text-[11px] text-white/60">
                      {new Date(ticket.checked_in_at).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : isExpired ? (
                <div className="text-center py-4">
                  <p className="font-bold text-white/80">Event ended</p>
                  <p className="mt-1 text-[11px] text-white/50">Check-in is closed.</p>
                </div>
              ) : (
                <TicketQRReveal qrDataUrl={qrDataUrl} ticketCode={String(ticket.ticket_code)} />
              )}
            </div>
          </div>
        </div>

        {!eventEnded && (
          <div className="flex justify-center mt-4">
            <AddToCalendarButton
              title={ticket.event_title}
              location={ticket.venue_name}
              startAt={ticket.start_at}
              endAt={ticket.end_at}
            />
          </div>
        )}

        <p className="text-center text-[11px] text-gray-600 mt-4">Powered by TicketHub</p>
      </div>
    </div>
  );
}

'@
$dir = "app\tickets\[code]"
if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
[System.IO.File]::WriteAllText("$dir\page.tsx", $content, $utf8NoBom)

if (-not (Test-Path -LiteralPath "$dir\page.tsx")) {
    Write-Host "ERROR: file was not created!" -ForegroundColor Red
} else {
    Write-Host "Confirmed on disk." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Green
    Write-Host "  git add ."
    Write-Host "  git commit -m ""Redesign ticket page: horizontal white/purple diagonal layout"""
    Write-Host "  git push origin main"
}
