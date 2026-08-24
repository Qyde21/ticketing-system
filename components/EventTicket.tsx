'use client';

import TicketBarcode from '@/components/TicketBarcode';
import { QRCodeSVG } from 'qrcode.react';

export type EventTicketProps = {
  eventTitle: string;
  ticketTypeName?: string;
  venueName?: string;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  holderName?: string | null;
  ticketCode: string;
  qrDataUrl?: string | null;
  status?: string;
  isExpired?: boolean;
  checkedInAt?: string | Date | null;
  coverImageUrl?: string | null;
};

// TicketHub brand tokens for the physical-ticket treatment.
const ACCENT = '#22d3ee';
const ACCENT_LIGHT = '#67e8f9';
const INK = '#11141C';
const PANEL_FROM = '#0B0E14';
const PANEL_VIA = '#151a26';
const PANEL_TO = '#1c2233';

function formatWhen(startAt?: string | Date | null) {
  if (!startAt) return 'Date TBA';
  try {
    return new Date(startAt).toLocaleString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(startAt);
  }
}

function CalendarGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', flexShrink: 0 }}>
      <rect x="3" y="5" width="18" height="16" rx="2" stroke={ACCENT} strokeWidth="1.8" />
      <path d="M3 10h18M8 3v4M16 3v4" stroke={ACCENT} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PinGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ display: 'inline-block', flexShrink: 0 }}>
      <path
        d="M12 21s7-6.4 7-11.5A7 7 0 0 0 5 9.5C5 14.6 12 21 12 21Z"
        stroke={ACCENT}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="9.5" r="2.4" stroke={ACCENT} strokeWidth="1.8" />
    </svg>
  );
}

/** Logo seal that straddles the perforation, like a hologram sticker on a physical ticket. */
function SealBadge() {
  return (
    <div
      className="absolute z-20 flex items-center justify-center rounded-full"
      style={{
        left: '100%',
        top: '50%',
        width: 36,
        height: 36,
        transform: 'translate(-50%, -50%)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
      }}
      aria-hidden
    >
      <img src="/logo-badge.png" alt="" className="h-full w-full rounded-full" />
    </div>
  );
}

/** Faint diagonal security-style watermark, blue-to-cyan, tiled across the ticket panel. */
function Watermark() {
  const rows = [0, 1, 2];
  return (
    <div
      className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none"
      aria-hidden
      style={{ opacity: 0.1 }}
    >
      <div
        className="absolute flex flex-col justify-around"
        style={{
          top: '-40%',
          left: '-25%',
          width: '160%',
          height: '180%',
          transform: 'rotate(-18deg)',
        }}
      >
        {rows.map((row) => (
          <div key={row} className="flex whitespace-nowrap gap-10">
            {[0, 1, 2, 3].map((col) => (
              <span
                key={col}
                className="font-serif font-black uppercase"
                style={{
                  fontSize: 34,
                  letterSpacing: '0.04em',
                  backgroundImage: 'linear-gradient(90deg, #38bdf8 0%, #22d3ee 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                TicketHub
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function EventTicket({
  eventTitle,
  ticketTypeName,
  venueName,
  startAt,
  holderName,
  ticketCode,
  qrDataUrl,
  status,
  isExpired = false,
  checkedInAt,
  coverImageUrl,
}: EventTicketProps) {
  const code = String(ticketCode || '').trim();
  const isUsed = status === 'used' || status === 'checked_in';
  const isDimmed = isUsed || isExpired;
  const poster =
    coverImageUrl && String(coverImageUrl).trim()
      ? String(coverImageUrl).trim()
      : null;

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <p className="text-[11px] text-gray-500 sm:hidden text-center px-2">
        Tip: rotate your phone for the largest view
      </p>

      <div className="w-full max-w-[920px] mx-auto">
        <div
          className={'relative flex w-full overflow-hidden rounded-2xl shadow-2xl ' + (isDimmed ? 'opacity-90' : '')}
          style={{
            aspectRatio: '2.35 / 1',
            minHeight: 160,
            background: `linear-gradient(135deg, ${PANEL_FROM} 0%, ${PANEL_VIA} 55%, ${PANEL_TO} 100%)`,
            boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(34,211,238,0.14)',
          }}
        >
          <div className="relative flex flex-[1.55] flex-col justify-between p-3 sm:p-5 md:p-6 text-left min-w-0 overflow-hidden">
            {poster && (
              <>
                <img
                  src={poster}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(105deg, rgba(6,8,13,0.94) 0%, rgba(15,18,28,0.84) 45%, rgba(28,34,51,0.7) 100%)',
                  }}
                />
              </>
            )}

            <Watermark />

            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <img src="/logo-badge.png" alt="" className="h-4 w-4 sm:h-5 sm:w-5 rounded-full flex-shrink-0" />
                <span
                  className="font-serif font-bold uppercase tracking-[0.15em]"
                  style={{ fontSize: 'clamp(9px, 1.6vw, 11px)' }}
                >
                  <span className="bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent font-bold">TicketHub</span>
                </span>
                <span className="text-slate-500" style={{ fontSize: 'clamp(9px, 1.6vw, 11px)' }}>
                  Â· Official ticket
                </span>
              </div>
              <h2
                className="font-serif font-black leading-[1.08] text-white line-clamp-2"
                style={{
                  fontSize: 'clamp(1rem, 3.8vw, 1.85rem)',
                  letterSpacing: '-0.01em',
                  textShadow: '0 2px 14px rgba(0,0,0,0.55)',
                }}
              >
                {eventTitle}
              </h2>
              {ticketTypeName && (
                <span
                  className="inline-block mt-2 font-bold uppercase tracking-wider rounded-full"
                  style={{
                    color: ACCENT_LIGHT,
                    border: `1px solid rgba(34,211,238,0.5)`,
                    background: 'rgba(34,211,238,0.08)',
                    fontSize: 'clamp(0.55rem, 1.5vw, 0.7rem)',
                    padding: '0.15rem 0.6rem',
                  }}
                >
                  {ticketTypeName}
                </span>
              )}
            </div>

            <div className="relative z-10 mt-2 space-y-1.5 min-w-0">
              <p
                className="text-white/95 font-medium truncate flex items-center gap-1.5"
                style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)' }}
              >
                <CalendarGlyph />
                {formatWhen(startAt)}
              </p>
              <p
                className="text-white/90 truncate flex items-center gap-1.5"
                style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)' }}
              >
                <PinGlyph />
                {venueName || 'Venue TBA'}
              </p>

              <div className="flex items-center gap-2 flex-wrap pt-1.5" style={{ borderTop: '1px solid rgba(34,211,238,0.18)' }}>
                {holderName && (
                  <span className="text-white/70 truncate" style={{ fontSize: 'clamp(0.6rem, 1.6vw, 0.78rem)' }}>
                    {holderName}
                  </span>
                )}
                <span
                  className="font-mono truncate rounded"
                  style={{
                    color: ACCENT_LIGHT,
                    fontSize: 'clamp(0.58rem, 1.6vw, 0.76rem)',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    border: '1px solid rgba(34,211,238,0.3)',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '0.1rem 0.45rem',
                  }}
                >
                  {code}
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex w-3 sm:w-4 flex-shrink-0 flex-col items-center justify-between py-2" aria-hidden>
            <div
              className="absolute inset-y-0 left-1/2 w-0 -translate-x-1/2 border-l border-dashed"
              style={{ borderColor: 'rgba(34,211,238,0.5)' }}
            />
            <div className="relative z-10 h-3 w-3 sm:h-4 sm:w-4 rounded-full" style={{ background: INK, marginTop: -6 }} />
            <SealBadge />
            <div className="relative z-10 h-3 w-3 sm:h-4 sm:w-4 rounded-full" style={{ background: INK, marginBottom: -6 }} />
          </div>

          <div
            className="relative flex flex-1 flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-w-0"
            style={{ background: 'linear-gradient(180deg, #F5F7FF 0%, #E7ECFA 100%)' }}
          >
            <p
              className="font-bold uppercase tracking-[0.15em] text-center"
              style={{ color: '#4338ca', fontSize: 'clamp(0.55rem, 1.5vw, 0.75rem)' }}
            >
              Scan at door
            </p>
            <div className="rounded-lg sm:rounded-xl border-2 p-1 sm:p-1.5 bg-white" style={{ borderColor: ACCENT }}>
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={'QR ' + code}
                  className="block"
                  style={{ width: 'clamp(72px, 18vw, 128px)', height: 'clamp(72px, 18vw, 128px)' }}
                />
              ) : (
                <QRCodeSVG
                  value={code || 'INVALID'}
                  size={128}
                  className="block"
                  style={{ width: 'clamp(72px, 18vw, 128px)', height: 'clamp(72px, 18vw, 128px)' }}
                  level="M"
                  includeMargin={false}
                />
              )}
            </div>
            <div className="w-full max-w-[140px] sm:max-w-[160px] opacity-90 hidden sm:block">
              <TicketBarcode value={code} height={36} />
            </div>
            {isUsed && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(127,29,29,0.85)' }}>
                <div className="text-center px-2">
                  <p className="text-white font-extrabold text-sm sm:text-base">Already scanned</p>
                  {checkedInAt && (
                    <p className="text-red-100 text-[10px] sm:text-xs mt-1">{new Date(checkedInAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}
            {!isUsed && isExpired && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(28,34,51,0.88)' }}>
                <div className="text-center px-2">
                  <p className="text-white font-extrabold text-sm sm:text-base">Expired</p>
                  <p className="text-gray-200 text-[10px] sm:text-xs mt-1">Event has ended</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

