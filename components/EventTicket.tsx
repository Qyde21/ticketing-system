ï»¿'use client';

import TicketBarcode from '@/components/TicketBarcode';

export type EventTicketProps = {
  eventTitle: string;
  ticketTypeName?: string;
  venueName?: string;
  startAt?: string | Date | null;
  endAt?: string | Date | null;
  holderName?: string | null;
  ticketCode: string;
  qrDataUrl: string;
  status?: string;
  isExpired?: boolean;
  checkedInAt?: string | Date | null;
  coverImageUrl?: string | null;
};

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
            background: 'linear-gradient(135deg, #1a0508 0%, #4a0e18 40%, #7f1d1d 100%)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06)',
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
                      'linear-gradient(105deg, rgba(10,2,4,0.92) 0%, rgba(40,8,14,0.78) 45%, rgba(80,15,25,0.65) 100%)',
                  }}
                />
              </>
            )}

            <div className="relative z-10">
              <p
                className="text-[9px] sm:text-xs font-bold uppercase tracking-[0.2em] mb-1"
                style={{ color: '#fbbf24' }}
              >
                TicketHub Â· Official ticket
              </p>
              <h2
                className="font-black leading-tight text-white line-clamp-2"
                style={{
                  fontSize: 'clamp(0.95rem, 3.6vw, 1.75rem)',
                  textShadow: '0 2px 12px rgba(0,0,0,0.5)',
                }}
              >
                {eventTitle}
              </h2>
              {ticketTypeName && (
                <p
                  className="mt-1 font-semibold"
                  style={{
                    color: '#fde68a',
                    fontSize: 'clamp(0.7rem, 2vw, 0.95rem)',
                  }}
                >
                  {ticketTypeName}
                </p>
              )}
            </div>

            <div className="relative z-10 mt-2 space-y-1 min-w-0">
              <p className="text-white/95 font-medium truncate" style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)' }}>
                <span style={{ color: '#fbbf24' }}>ðŸ“… </span>
                {formatWhen(startAt)}
              </p>
              <p className="text-white/90 truncate" style={{ fontSize: 'clamp(0.65rem, 1.8vw, 0.85rem)' }}>
                <span style={{ color: '#fbbf24' }}>ðŸ“ </span>
                {venueName || 'Venue TBA'}
              </p>
              {holderName && (
                <p className="text-white/80 truncate" style={{ fontSize: 'clamp(0.6rem, 1.6vw, 0.8rem)' }}>
                  Holder: {holderName}
                </p>
              )}
              <p
                className="font-mono tracking-wider truncate pt-1"
                style={{ color: '#c7d2fe', fontSize: 'clamp(0.6rem, 1.7vw, 0.8rem)', fontWeight: 700 }}
              >
                {code}
              </p>
            </div>
          </div>

          <div className="relative z-10 flex w-3 sm:w-4 flex-shrink-0 flex-col items-center justify-between py-2" aria-hidden>
            <div className="absolute inset-y-0 left-1/2 w-0 -translate-x-1/2 border-l border-dashed" style={{ borderColor: 'rgba(251,191,36,0.45)' }} />
            <div className="relative z-10 h-3 w-3 sm:h-4 sm:w-4 rounded-full" style={{ background: '#0a0a0a', marginTop: -6 }} />
            <div className="relative z-10 h-3 w-3 sm:h-4 sm:w-4 rounded-full" style={{ background: '#0a0a0a', marginBottom: -6 }} />
          </div>

          <div
            className="relative flex flex-1 flex-col items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-w-0"
            style={{ background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)' }}
          >
            <p className="font-bold uppercase tracking-wider text-center" style={{ color: '#7f1d1d', fontSize: 'clamp(0.55rem, 1.5vw, 0.75rem)' }}>
              Scan at door
            </p>
            <div className="rounded-lg sm:rounded-xl border-2 p-1 sm:p-1.5 bg-white" style={{ borderColor: '#7f1d1d' }}>
              <img
                src={qrDataUrl}
                alt={'QR ' + code}
                className="block"
                style={{ width: 'clamp(72px, 18vw, 128px)', height: 'clamp(72px, 18vw, 128px)' }}
              />
            </div>
            <div className="w-full max-w-[140px] sm:max-w-[160px] opacity-90 hidden sm:block">
              <TicketBarcode value={code} height={36} />
            </div>
            {isUsed && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(127,29,29,0.82)' }}>
                <div className="text-center px-2">
                  <p className="text-white font-extrabold text-sm sm:text-base">Already scanned</p>
                  {checkedInAt && (
                    <p className="text-red-100 text-[10px] sm:text-xs mt-1">{new Date(checkedInAt).toLocaleString()}</p>
                  )}
                </div>
              </div>
            )}
            {!isUsed && isExpired && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(55,65,81,0.85)' }}>
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