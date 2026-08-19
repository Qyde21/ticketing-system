'use client';
import TicketBarcode from '@/components/TicketBarcode';

export default function TicketQRReveal({
  qrDataUrl,
  ticketCode,
}: {
  qrDataUrl: string;
  ticketCode: string;
}) {
  const code = String(ticketCode || '').trim().toUpperCase();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        width: '100%',
      }}
    >
      <div
        style={{
          background: '#fff',
          padding: 16,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
        }}
      >
        <img
          src={qrDataUrl}
          alt={'QR ' + code}
          width={220}
          height={220}
          style={{ display: 'block', width: 220, height: 220 }}
        />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>QR code</p>

      <div
        style={{
          width: '100%',
          maxWidth: 400,
          padding: '12px 8px',
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #e5e7eb',
        }}
      >
        <TicketBarcode value={code} height={120} moduleWidth={3} />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
        Barcode · prefer print or full brightness; scan either at the door
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: 2,
          color: '#a5b4fc',
          fontSize: 15,
          fontWeight: 700,
        }}
      >
        {code}
      </p>
    </div>
  );
}
