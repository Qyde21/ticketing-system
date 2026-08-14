'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  enqueueCheckin,
  listQueue,
  loadManifest,
  removeFromQueue,
  saveManifest,
  tryMarkUsed,
} from './offlineStore';
import { flushCheckinQueueNow, registerScanServiceWorker, requestCheckinBackgroundSync } from './registerScanSw';

interface LiveStats {
  total: number;
  checkedIn: number;
  remaining: number;
  cancelled?: number;
  recent?: Array<{
    ticketCode: string;
    holderName: string | null;
    ticketType: string | null;
    checkedInAt: string | null;
  }>;
}

interface CheckinResult {
  status: 'success' | 'error';
  message: string;
  holderName?: string;
}

function playTone(kind: 'ok' | 'err') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = kind === 'ok' ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, kind === 'ok' ? 120 : 280);
  } catch {
    /* ignore */
  }
}


/** Ticket QR encodes the ticket code; also accept full ticket URLs. */
function normalizeTicketCode(raw: string): string {
  let s = (raw || '').trim();
  if (!s) return '';
  try {
    if (s.includes('://') || s.startsWith('/tickets/')) {
      const pathPart = s.includes('://') ? new URL(s).pathname : s;
      const parts = pathPart.split('/').filter(Boolean);
      const i = parts.indexOf('tickets');
      if (i >= 0 && parts[i + 1]) s = parts[i + 1];
      else if (parts.length) s = parts[parts.length - 1];
    }
  } catch {
    /* keep raw */
  }
  return s.toUpperCase().replace(/\s+/g, '');
}
export default function Scanner({
  eventId,
  initialCheckedIn,
  initialTotal,
}: {
  eventId: string;
  initialCheckedIn: number;
  initialTotal: number;
}) {
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [stats, setStats] = useState<LiveStats>({
    total: initialTotal,
    checkedIn: initialCheckedIn,
    remaining: Math.max(0, initialTotal - initialCheckedIn),
    recent: [],
  });
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [online, setOnline] = useState(true);
  const [packReady, setPackReady] = useState(false);
  const [packInfo, setPackInfo] = useState('');
  const [pendingSync, setPendingSync] = useState(0);
  const [packBusy, setPackBusy] = useState(false);

  const scannerRef = useRef<any>(null);
  const lastCodeRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  const applyStats = useCallback((s: LiveStats) => {
    setStats({
      total: Number(s.total) || 0,
      checkedIn: Number(s.checkedIn) || 0,
      remaining: Number(s.remaining) || 0,
      cancelled: s.cancelled,
      recent: s.recent || [],
    });
  }, []);

  const refreshStats = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    try {
      const res = await fetch(`/api/checkin?eventId=${encodeURIComponent(eventId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      applyStats(await res.json());
    } catch {
      /* offline */
    }
  }, [eventId, applyStats]);

  const refreshQueueCount = useCallback(async () => {
    try {
      const items = await listQueue(eventId);
      setPendingSync(items.length);
    } catch {
      /* ignore */
    }
  }, [eventId]);

  const downloadPack = useCallback(async () => {
    setPackBusy(true);
    try {
      const res = await fetch(`/api/checkin/manifest?eventId=${encodeURIComponent(eventId)}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to download ticket pack');
      }
      const data = await res.json();
      await saveManifest({
        eventId: data.eventId,
        eventTitle: data.eventTitle,
        downloadedAt: data.downloadedAt,
        tickets: data.tickets,
      });
      setPackReady(true);
      setPackInfo(`${data.tickets.length} tickets · ${new Date(data.downloadedAt).toLocaleTimeString()}`);
      setResult({
        status: 'success',
        message: `Offline pack ready (${data.tickets.length} tickets)`,
      });
    } catch (err: any) {
      setResult({
        status: 'error',
        message: err?.message || 'Could not download ticket pack',
      });
    } finally {
      setPackBusy(false);
    }
  }, [eventId]);

  const syncQueue = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    const items = await listQueue(eventId);
    for (const item of items) {
      try {
        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketCode: item.ticketCode, eventId }),
        });
        if (res.ok || res.status === 409 || res.status === 400) {
          await removeFromQueue(item.id);
        } else {
          break;
        }
      } catch {
        break;
      }
    }
    await refreshQueueCount();
    await refreshStats();
  }, [eventId, refreshQueueCount, refreshStats]);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const on = () => {
      setOnline(true);
      void flushCheckinQueueNow();
      void syncQueue();
      void refreshStats();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [syncQueue, refreshStats]);

  useEffect(() => {
    void (async () => {
      const existing = await loadManifest(eventId);
      if (existing) {
        setPackReady(true);
        setPackInfo(
          `${existing.tickets.length} tickets · ${new Date(existing.downloadedAt).toLocaleTimeString()}`
        );
      }
      await refreshQueueCount();
    })();
  }, [eventId, refreshQueueCount]);

  useEffect(() => {
    void registerScanServiceWorker();
  }, []);

  useEffect(() => {
    if (!online) return;
    void refreshStats();
    const id = setInterval(() => void refreshStats(), 3000);
    return () => clearInterval(id);
  }, [online, refreshStats]);

  const doCheckin = useCallback(
    async (rawCode: string) => {
      const code = normalizeTicketCode(rawCode);
      if (!code || processingRef.current) return;
      if (code === lastCodeRef.current) return;
      processingRef.current = true;
      lastCodeRef.current = code;
      setBusy(true);

      try {
        const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

        if (!isOnline) {
          const local = await tryMarkUsed(eventId, code);
          if (!local) {
            playTone('err');
            setResult({
              status: 'error',
              message: packReady
                ? 'Invalid ticket (not in offline pack)'
                : 'No offline pack — connect once and download tickets',
            });
          } else if (local.cancelled) {
            playTone('err');
            setResult({
              status: 'error',
              message: 'Ticket cancelled',
              holderName: local.ticket.holderName || undefined,
            });
          } else if (local.alreadyUsed) {
            playTone('err');
            setResult({
              status: 'error',
              message: 'Already checked in (offline)',
              holderName: local.ticket.holderName || undefined,
            });
          } else {
            await enqueueCheckin(eventId, code);
            playTone('ok');
            setResult({
              status: 'success',
              message: 'Checked in offline — will sync when online',
              holderName: local.ticket.holderName || undefined,
            });
            setStats((s) => ({
              ...s,
              checkedIn: s.checkedIn + 1,
              remaining: Math.max(0, s.remaining - 1),
            }));
            setPendingSync((n) => n + 1);
          }
          return;
        }

        const res = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticketCode: code, eventId }),
        });
        const data = await res.json();
        if (data.stats) applyStats(data.stats);
        if (res.ok) {
          playTone('ok');
          setResult({
            status: 'success',
            message: data.message || 'Checked in successfully',
            holderName: data.holderName,
          });
          // Keep offline pack in sync when online
          try {
            await tryMarkUsed(eventId, code);
          } catch {
            /* pack optional */
          }
        } else {
          playTone('err');
          setResult({
            status: 'error',
            message: data.error || data.message || 'Check-in failed',
            holderName: data.holderName,
          });
        }
      } catch {
        playTone('err');
        setResult({ status: 'error', message: 'Network error — try offline pack or retry' });
      } finally {
        setBusy(false);
        setTimeout(() => {
          lastCodeRef.current = null;
          processingRef.current = false;
        }, 2500);
      }
    },
    [eventId, applyStats, packReady]
  );

  useEffect(() => {
    let mounted = true;
    import('html5-qrcode')
      .then(({ Html5QrcodeScanner }) => {
        if (!mounted) return;
        const scanner = new Html5QrcodeScanner(
          'reader',
          {
            fps: 10,
            qrbox: { width: 260, height: 260 },
            rememberLastUsedCamera: true,
            aspectRatio: 1,
            videoConstraints: { facingMode: { ideal: 'environment' } },
          },
          false
        );
        scanner.render(
          (decodedText: string) => {
            void doCheckin(decodedText);
          },
          () => {}
        );
        scannerRef.current = scanner;
      })
      .catch(() => {
        if (mounted) setCameraError('Camera unavailable or permission denied. Allow camera access, or type the ticket code below.');
      });
    return () => {
      mounted = false;
      scannerRef.current?.clear?.().catch(() => {});
    };
  }, [doCheckin]);

  const percent = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className={online ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
          {online ? '● Online' : '● Offline mode'}
        </span>
        {packReady ? (
          <span className="text-gray-400">Pack: {packInfo}</span>
        ) : (
          <span className="text-gray-500">No offline pack yet</span>
        )}
        {pendingSync > 0 && (
          <span className="text-amber-300 font-semibold">{pendingSync} waiting to sync</span>
        )}
        <button
          type="button"
          disabled={packBusy || !online}
          onClick={() => void downloadPack()}
          className="text-indigo-400 hover:text-indigo-300 disabled:opacity-40 underline"
        >
          {packBusy ? 'Downloading…' : 'Download / refresh ticket pack'}
        </button>
        {online && pendingSync > 0 && (
          <button
            type="button"
            onClick={() => void syncQueue()}
            className="text-cyan-400 hover:text-cyan-300 underline"
          >
            Sync now
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-4">
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{stats.checkedIn}</div>
          <div className="text-xs text-gray-400 mt-0.5">Checked in</div>
        </div>
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{stats.remaining}</div>
          <div className="text-xs text-gray-400 mt-0.5">Not yet in</div>
        </div>
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl px-3 py-3 text-center">
          <div className="text-2xl font-bold text-white">{stats.total}</div>
          <div className="text-xs text-gray-400 mt-0.5">Total · {percent}%</div>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-2 flex justify-between">
        <span>Point camera at QR code</span>
        <button
          type="button"
          onClick={() => void refreshStats()}
          className="text-indigo-400 hover:text-indigo-300"
          disabled={!online}
        >
          Refresh
        </button>
      </p>
      {cameraError && (
        <p className="text-amber-400 text-sm mb-3 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">
          {cameraError}
        </p>
      )}
      <div id="reader" className="rounded-xl overflow-hidden mb-4" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) {
            void doCheckin(manualCode);
            setManualCode('');
          }
        }}
        className="flex gap-2 mb-4"
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value.toUpperCase())}
          placeholder="Or type ticket code"
          autoComplete="off"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono tracking-wider focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={busy || !manualCode.trim()}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition"
        >
          {busy ? '…' : 'Check in'}
        </button>
      </form>
      {result && (
        <div
          className={
            'mb-4 p-4 rounded-xl border ' +
            (result.status === 'success'
              ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200'
              : 'bg-red-950/50 border-red-700 text-red-200')
          }
        >
          <strong className="text-base">
            {result.status === 'success' ? '✓ ' + result.message : '✗ ' + result.message}
          </strong>
          {result.holderName && <p className="mt-1 text-sm opacity-90">{result.holderName}</p>}
        </div>
      )}
      {stats.recent && stats.recent.length > 0 && (
        <div className="mt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
            Recent check-ins
          </h3>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {stats.recent.map((r) => (
              <li
                key={r.ticketCode + (r.checkedInAt || '')}
                className="flex justify-between items-center bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-mono text-emerald-300 text-xs">{r.ticketCode}</span>
                  {r.holderName && <span className="text-gray-300 ml-2">{r.holderName}</span>}
                </div>
                <span className="text-xs text-gray-500">
                  {r.checkedInAt ? new Date(r.checkedInAt).toLocaleTimeString() : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}