'use client';
import TicketBarcode from '@/components/TicketBarcode';

export default function TicketQRReveal({ qrDataUrl, ticketCode }: { qrDataUrl: string; ticketCode: string }) {
  const code = String(ticketCode || '').trim();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%' }}>
      <div style={{ background: '#fff', padding: 12, borderRadius: 12, border: '1px solid #e5e7eb' }}>
        <img src={qrDataUrl} alt={'QR ' + code} width={200} height={200} style={{ display: 'block', width: 200, height: 200 }} />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>QR code</p>
      <div style={{ width: '100%', maxWidth: 340 }}>
        <TicketBarcode value={code} height={84} />
      </div>
      <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>Barcode · scan either at the door</p>
      <p style={{ margin: 0, fontFamily: 'ui-monospace, monospace', letterSpacing: 2, color: '#a5b4fc', fontSize: 14, fontWeight: 700 }}>{code}</p>
    </div>
  );
}
