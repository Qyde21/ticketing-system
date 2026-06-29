'use client';
import { useEffect, useRef, useState } from 'react';

interface CheckinResult {
  status: 'success' | 'error';
  message: string;
  holderName?: string;
}

export default function Scanner({ eventId }: { eventId: string }) {
  const [result, setResult] = useState<CheckinResult | null>(null);
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

          setResult({
            status: res.ok ? 'success' : 'error',
            message: data.message || data.error,
            holderName: data.holderName,
          });

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

  return (
    <div>
      <div id="reader" />
      {result && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: result.status === 'success' ? '#d4edda' : '#f8d7da',
            color: result.status === 'success' ? '#155724' : '#721c24',
          }}
        >
          <strong>{result.status === 'success' ? '✓ Checked in' : `✕ ${result.message}`}</strong>
          {result.holderName && <p>{result.holderName}</p>}
        </div>
      )}
    </div>
  );
}