'use client';
import { useEffect, useRef, useState } from 'react';

interface CheckinResult {
  status: 'success' | 'error';
  message: string;
  holderName?: string;
}

export default function Scanner({ eventId, initialCheckedIn, initialTotal }: { eventId: string; initialCheckedIn: number; initialTotal: number }) {
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const scannerRef = useRef<any>(null);
  const lastCodeRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (!mounted) return;

      const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 250 }, false);

      scanner.render(
        async (decodedText: string) => {
          if (decodedText === lastCodeRef.current) return;
          lastCodeRef.current = decodedText;

          const res = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticketCode: decodedText, eventId }),
          });
          const data = await res.json();

          if (res.ok) {
            setCheckedIn((prev) => prev + 1);
            setResult({ status: 'success', message: data.message, holderName: data.holderName });
          } else {
            setResult({ status: 'error', message: data.error, holderName: data.holderName });
          }

          setTimeout(() => { lastCodeRef.current = null; }, 3000);
        },
        () => {}
      );

      scannerRef.current = scanner;
    });

    return () => {
      mounted = false;
      scannerRef.current?.clear().catch(() => {});
    };
  }, [eventId]);

  const percent = initialTotal > 0 ? Math.round((checkedIn / initialTotal) * 100) : 0;

  return (
    <div>
      {/* Live updated counter */}
      <div style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 14, color: '#166534', fontWeight: 600 }}>Live count: {checkedIn} / {initialTotal} checked in</span>
        <span style={{ fontSize: 13, color: '#16a34a', fontWeight: 700 }}>{percent}%</span>
      </div>

      <div id="reader" />

      {result && (
        <div style={{ marginTop: 16, padding: 12, borderRadius: 8, background: result.status === 'success' ? '#d4edda' : '#f8d7da', color: result.status === 'success' ? '#155724' : '#721c24' }}>
          <strong>{result.status === 'success' ? '✓ Checked in' : result.message}</strong>
          {result.holderName && <p style={{ margin: '4px 0 0' }}>{result.holderName}</p>}
        </div>
      )}
    </div>
  );
}