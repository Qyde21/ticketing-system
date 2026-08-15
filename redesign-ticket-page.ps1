# Run this from your project root
# Usage: powershell -ExecutionPolicy Bypass -File redesign-ticket-page.ps1
#
# Redesigns the buyer-facing ticket page (app/tickets/[code]/page.tsx) into
# a proper torn-stub ticket card: cover-image (or gradient) admission panel
# with status badge, a real perforated tear line, and a cream paper stub
# holding the existing QR/barcode. TicketQRReveal and TicketBarcode
# components are untouched — only this page's own markup changed, so
# nothing that reuses those components elsewhere is affected.
# Also fixes a corrupted character that was in the old version.

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
           tt.name AS ticket_type_name,
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
    ? 'bg-red-950/70 text-red-300 border-red-800'
    : isExpired
    ? 'bg-gray-800/80 text-gray-400 border-gray-700'
    : 'bg-emerald-500 text-emerald-950 border-emerald-400';

  const dateStr = new Date(ticket.start_at).toLocaleDateString('en-KE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeStr = new Date(ticket.start_at).toLocaleTimeString('en-KE', {
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="rounded-[28px] overflow-hidden shadow-2xl shadow-black/60 border border-gray-800 bg-gray-900">
          {/* Admission panel */}
          <div
            className="relative px-6 pt-6 pb-9 bg-cover bg-center"
            style={
              ticket.cover_image_url
                ? { backgroundImage: `url(${ticket.cover_image_url})` }
                : { backgroundImage: 'linear-gradient(135deg, #c026d3 0%, #f43f5e 50%, #f59e0b 100%)' }
            }
          >
            <div
              className="absolute inset-0"
              style={{
                background: ticket.cover_image_url
                  ? 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 60%, rgba(17,24,39,0.95) 100%)'
                  : 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.35) 100%)',
              }}
            />

            <div className="relative flex items-start justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">
                Admit One
              </span>
              <span
                className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusClasses}`}
              >
                {statusLabel}
              </span>
            </div>

            <h1 className="relative mt-3 text-[26px] leading-[1.05] font-extrabold text-white tracking-tight drop-shadow-sm">
              {ticket.event_title}
            </h1>

            <p className="relative mt-2 text-sm font-semibold text-white/90">
              {ticket.ticket_type_name}
              {ticket.holder_name ? ` · ${ticket.holder_name}` : ''}
            </p>

            <div className="relative mt-4 flex items-center gap-4 text-xs font-medium text-white/80">
              <span className="flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M8 3v4M16 3v4M3 10h18" />
                </svg>
                {dateStr}, {timeStr}
              </span>
              <span className="flex items-center gap-1.5 truncate">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="shrink-0">
                  <path d="M12 21s-7-6.1-7-11.5C5 5.4 8.1 3 12 3s7 2.4 7 6.5C19 14.9 12 21 12 21z" />
                  <circle cx="12" cy="9.5" r="2.2" />
                </svg>
                <span className="truncate">{ticket.venue_name}</span>
              </span>
            </div>
          </div>

          {/* Perforated tear line */}
          <div className="relative h-0">
            <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-gray-950" />
            <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-gray-950" />
            <div className="absolute left-3 right-3 -top-[1px] border-t-2 border-dashed border-gray-700" />
          </div>

          {/* Stub panel */}
          <div className="bg-[#F5F1E8] px-6 pt-8 pb-7">
            {isUsed ? (
              <div className="py-8 text-center">
                <div className="mx-auto w-fit rounded-2xl bg-red-100 border border-red-300 text-red-700 font-bold px-5 py-3">
                  Already scanned
                </div>
                {ticket.checked_in_at && (
                  <p className="mt-3 text-xs text-gray-500">
                    {new Date(ticket.checked_in_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : isExpired ? (
              <div className="py-8 text-center">
                <div className="mx-auto w-fit rounded-2xl bg-gray-200 border border-gray-300 text-gray-600 font-bold px-5 py-3">
                  Event ended
                </div>
                <p className="mt-3 text-xs text-gray-500">Check-in closed after the event ended.</p>
              </div>
            ) : (
              <TicketQRReveal qrDataUrl={qrDataUrl} ticketCode={String(ticket.ticket_code)} />
            )}

            {!eventEnded && (
              <div className="flex justify-center mt-6 pt-5 border-t border-gray-300/70">
                <AddToCalendarButton
                  title={ticket.event_title}
                  location={ticket.venue_name}
                  startAt={ticket.start_at}
                  endAt={ticket.end_at}
                />
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-4">
          Powered by TicketHub
        </p>
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
    Write-Host "  git commit -m ""Redesign ticket page as a torn-stub ticket card"""
    Write-Host "  git push origin main"
}
