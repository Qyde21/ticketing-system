'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface CheckinResult {
  status: 'success' | 'error';
  message: string;
  holderName?: string;
}

export default function Scanner({ eventId, initialCheckedIn, initialTotal }: { eventId: string; initialCheckedIn: number; initialTotal: number }) {
  const router = useRouter();
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [checkedIn, setCheckedIn] = useState(initialCheckedIn);
  const scannerRef = useRef<any>(null);
  const lastCodeRef = useRef<string | null>(null);

  // Sync state if server numbers change
  useEffect(() => {
    setCheckedIn(initialCheckedIn);
  }, [initialCheckedIn]);

  // Helper function to extract any UTC/ISO time in the message and convert it to EAT (Local Time)
  const formatTimeInMessage = (msg: string) => {
    if (!msg) return msg;
    
    // Regex to detect an ISO timestamp (e.g., 2026-07-17T05:45:38.000Z)
    const isoRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/;
    const match = msg.match(isoRegex);
    
    if (match) {
      try {
        const utcDate = new Date(match[0]);
        const localTimeStr = utcDate.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        return msg.replace(match[0], localTimeStr);
      } catch (e) {
        return msg;
      }
    }
    
    // Fallback: If it's a raw timestamp string like "05:45:38", construct a date to convert UTC to Local
    const rawTimeRegex = /(\d{1,2}):(\d{2}):(\d{2})/;
    const rawMatch = msg.match(rawTimeRegex);
    if (rawMatch && !msg.toLowerCase().includes('am') && !msg.toLowerCase().includes('pm')) {
      try {
        const now = new Date();
        const utcDate = new Date(Date.UTC(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          parseInt(rawMatch[1]),
          parseInt(rawMatch[2]),
          parseInt(rawMatch[3])
        ));
        const localTimeStr = utcDate.toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });
        return msg.replace(rawMatch[0], localTimeStr);
      } catch (e) {
        return msg;
      }
    }

    return msg;
  };

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
            
            // Instantly refresh Server Component cards at the top of the screen!
            router.refresh();
          } else {
            // Check if error message contains a UTC timestamp and localize it
            const localizedMessage = formatTimeInMessage(data.error || data.message);
            setResult({ status: 'error', message: localizedMessage, holderName: data.holderName });
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
  }, [eventId, router]);

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
