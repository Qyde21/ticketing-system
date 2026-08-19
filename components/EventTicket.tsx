'use client';

import React from 'react';
import TicketBarcode from '@/components/TicketBarcode';

type Props = {
  eventTitle: string;
  ticketTypeName?: string | null;
  venueName?: string | null;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  holderName?: string | null;
  ticketCode: string;
  qrDataUrl: string;
  status?: string | null;
  isExpired?: boolean;
  checkedInAt?: string | Date | null;
  coverImageUrl?: string | null;
};

function formatWhen(d?: string | Date | null) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function EventTicket({
  eventTitle,
  ticketTypeName,
  venueName,
  startAt,
  endAt,
  holderName,
  ticketCode,
  qrDataUrl,
  status,
  isExpired,
  checkedInAt,
  coverImageUrl,
}: Props) {
  const code = String(ticketCode || '').trim();
  const used = status === 'used' || !!checkedInAt;
  const expired = !!isExpired && !used;

  return (
    <div className="w-full max-w-3xl mx-auto" style={{ aspectRatio: '2.35 / 1', minHeight: 200 }}>
      <div
        className="relative flex h-full w-full overflow-hidden rounded-2xl border shadow-2xl"
        style={{
          borderColor: 'rgba(99, 102, 241, 0.45)',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 45%, #0f172a 100%)',
          boxShadow: '0 0 0 1px rgba(34, 211, 238, 0.12), 0 20px 50px rgba(0,0,0,0.45)',
        }}
      >
        <div className="relative flex-[1.35] min-w-0 overflow-hidden">
          {coverImageUrl ? (
            <>
              <img src={coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'linear-gradient(90deg, rgba(15,23,42,0.94) 0%, rgba(30,27,75,0.8) 55%, rgba(15,23,42,0.6) 100%)',
                }}
              />
            </>
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 20% 30%, rgba(99,102,241,0.35), transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(34,211,238,0.2), transparent 50%)',
              }}
            />
          )}

          {/* Watermark */}
          <div
            className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center overflow-hidden"
            aria-hidden
          >
            <img
              src="/logo-badge.png"
              alt=""
              className="absolute"
              style={{
                width: '42%',
                maxWidth: 180,
                opacity: 0.12,
                filter: 'grayscale(20%)',
                transform: 'rotate(-18deg)',
              }}
            />
            <span
              className="absolute font-extrabold select-none"
              style={{
                fontSize: 'clamp(2.5rem, 9vw, 4.5rem)',
                letterSpacing: '-0.02em',
                background: 'linear-gradient(120deg, rgba(129,140,248,0.22), rgba(34,211,238,0.18))',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                transform: 'rotate(-12deg)',
                whiteSpace: 'nowrap',
                userSelect: 'none',
              }}
            >
              TicketHub
            </span>
          </div>

          <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5">
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <img
                  src="/logo-badge.png"
                  alt="TicketHub"
                  className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg shadow-md"
                  style={{ boxShadow: '0 4px 14px rgba(99,102,241,0.35)' }}
                />
                <div>
                  <p
                    className="text-sm sm:text-base font-extrabold leading-tight"
                    style={{
                      background: 'linear-gradient(90deg, #818cf8, #22d3ee)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    TicketHub
                  </p>
                  <p
                    className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.18em]"
                    style={{ color: 'rgba(165,180,252,0.85)' }}
                  >
                    Official ticket
                  </p>
                </div>
              </div>

              <h2
                className="font-extrabold leading-tight text-white"
                style={{
                  fontSize: 'clamp(1rem, 2.8vw, 1.45rem)',
                  textShadow: '0 2px 12px rgba(0,0,0,0.55)',
                }}
              >
                {eventTitle || 'Event'}
              </h2>
              {ticketTypeName && (
                <span
                  className="inline-block mt-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, rgba(99,102,241,0.4), rgba(34,211,238,0.28))',
                    border: '1px solid rgba(129,140,248,0.55)',
                    color: '#c7d2fe',
                  }}
                >
                  {ticketTypeName}
                </span>
              )}
            </div>

            <div className="space-y-1.5 mt-3">
              {venueName && (
                <p className="text-xs sm:text-sm font-semibold" style={{ color: '#67e8f9' }}>
                  📍 {venueName}
                </p>
              )}
              {startAt && (
                <p className="text-xs sm:text-sm font-medium" style={{ color: '#c7d2fe' }}>
                  <span style={{ color: '#818cf8' }}>🗓 </span>
                  {formatWhen(startAt)}
                  {endAt ? ` – ${formatWhen(endAt)}` : ''}
                </p>
              )}
              {holderName && (
                <p className="text-xs sm:text-sm" style={{ color: '#e0e7ff' }}>
                  <span className="font-semibold" style={{ color: '#a5b4fc' }}>Guest: </span>
                  {holderName}
                </p>
              )}
            </div>
          </div>
        </div>

        <div
          className="relative flex w-3 flex-col items-center justify-between py-3 shrink-0"
          style={{
            background: 'linear-gradient(180deg, #1e1b4b, #0f172a)',
            borderLeft: '1px dashed rgba(129,140,248,0.35)',
            borderRight: '1px dashed rgba(34,211,238,0.25)',
          }}
        >
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full"
              style={{
                background: 'rgba(15,23,42,0.9)',
                boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.4)',
              }}
            />
          ))}
        </div>

        <div
          className="relative flex w-[38%] min-w-[140px] max-w-[220px] flex-col items-center justify-center gap-2 p-3 sm:p-4"
          style={{
            background: 'linear-gradient(180deg, #f8fafc 0%, #eef2ff 50%, #ecfeff 100%)',
          }}
        >
          <img src="/logo-badge.png" alt="" className="absolute top-2 right-2 h-6 w-6 rounded opacity-40" />

          {(used || expired) && (
            <div
              className="absolute inset-0 z-20 flex items-center justify-center"
              style={{ background: 'rgba(15,23,42,0.72)' }}
            >
              <span
                className="rotate-[-12deg] rounded-lg px-3 py-1.5 text-sm font-extrabold uppercase tracking-wider"
                style={
                  used
                    ? {
                        color: '#fca5a5',
                        border: '2px solid #f87171',
                        background: 'rgba(127,29,29,0.5)',
                      }
                    : {
                        color: '#fcd34d',
                        border: '2px solid #f59e0b',
                        background: 'rgba(120,53,15,0.55)',
                      }
                }
              >
                {used ? 'Checked in' : 'Expired'}
              </span>
            </div>
          )}

          <img
            src={qrDataUrl}
            alt={'QR ' + code}
            width={120}
            height={120}
            className="rounded-lg border border-indigo-200 shadow-sm"
            style={{ width: 'min(120px, 28vw)', height: 'auto', aspectRatio: '1' }}
          />
          <p className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest" style={{ color: '#6366f1' }}>
            Scan at door
          </p>

          <div className="w-full max-w-[160px]">
            <TicketBarcode value={code} height={48} />
          </div>

          <p className="font-mono text-[10px] sm:text-xs font-bold tracking-widest" style={{ color: '#4338ca' }}>
            {code}
          </p>
        </div>
      </div>
    </div>
  );
}

