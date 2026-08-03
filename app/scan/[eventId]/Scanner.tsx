'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

interface LiveStats {
  total: number;
  checkedIn: number;
  remaining: number;
  cancelled?: number;
  recent?: Array<{ ticketCode: string; holderName: string | null; ticketType: string | null; checkedInAt: string | null }>;
}
interface CheckinResult { status: 'success' | 'error'; message: string; holderName?: string }

function playTone(kind: 'ok' | 'err') {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = kind === 'ok' ? 880 : 220;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, kind === 'ok' ? 120 : 280);
  } catch {}
}

export default function Scanner({ eventId, initialCheckedIn, initialTotal }: { eventId: string; initialCheckedIn: number; initialTotal: number }) {
  const [result, setResult] = useState<CheckinResult | null>(null);
  const [stats, setStats] = useState<LiveStats>({ total: initialTotal, checkedIn: initialCheckedIn, remaining: Math.max(0, initialTotal - initialCheckedIn), recent: [] });
  const [manualCode, setManualCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const scannerRef = useRef<any>(null);
  const lastCodeRef = useRef<string | null>(null);
  const processingRef = useRef(false);

  const applyStats = useCallback((s: LiveStats) => {
    setStats({ total: Number(s.total) || 0, checkedIn: Number(s.checkedIn) || 0, remaining: Number(s.remaining) || 0, cancelled: s.cancelled, recent: s.recent || [] });
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkin?eventId=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
      if (!res.ok) return;
      applyStats(await res.json());
    } catch {}
  }, [eventId, applyStats]);

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 3000);
    return () => clearInterval(id);
  }, [refreshStats]);

  const doCheckin = useCallback(async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code || processingRef.current) return;
    if (code === lastCodeRef.current) return;
    processingRef.current = true;
    lastCodeRef.current = code;
    setBusy(true);
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketCode: code, eventId }),
      });
      const data = await res.json();
      if (data.stats) applyStats(data.stats);
      if (res.ok) {
        playTone('ok');
        setResult({ status: 'success', message: data.message || 'Checked in successfully', holderName: data.holderName });
      } else {
        playTone('err');
        setResult({ status: 'error', message: data.error || data.message || 'Check-in failed', holderName: data.holderName });
      }
    } catch {
      playTone('err');
      setResult({ status: 'error', message: 'Network error — try again' });
    } finally {
      setBusy(false);
      setTimeout(() => { lastCodeRef.current = null; processingRef.current = false; }, 2500);
    }
  }, [eventId, applyStats]);

  useEffect(() => {
    let mounted = true;
    import('html5-qrcode').then(({ Html5QrcodeScanner }) => {
      if (!mounted) return;
      const scanner = new Html5QrcodeScanner('reader', { fps: 8, qrbox: { width: 240, height: 240 }, rememberLastUsedCamera: true }, false);
      scanner.render((decodedText: string) => { void doCheckin(decodedText); }, () => {});
      scannerRef.current = scanner;
    }).catch(() => { if (mounted) setCameraError('Camera scanner failed to load. Use manual entry below.'); });
    return () => { mounted = false; scannerRef.current?.clear?.().catch(() => {}); };
  }, [doCheckin]);

  const percent = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;

  return (
    <div>
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
          <div className="text-2xl font-bold text-indigo-400">{stats.total}</div>
          <div className="text-xs text-gray-400 mt-0.5">Total</div>
        </div>
      </div>
      <div className="bg-gray-800 rounded-full overflow-hidden mb-2" style={{ height: 8 }}>
        <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-gray-400 mb-4 flex justify-between">
        <span>{percent}% checked in · live</span>
        <button type="button" onClick={() => void refreshStats()} className="text-indigo-400 hover:text-indigo-300">Refresh</button>
      </p>
      {cameraError && <p className="text-amber-400 text-sm mb-3 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2">{cameraError}</p>}
      <div id="reader" className="rounded-xl overflow-hidden mb-4" />
      <form onSubmit={(e) => { e.preventDefault(); if (manualCode.trim()) { void doCheckin(manualCode); setManualCode(''); } }} className="flex gap-2 mb-4">
        <input value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} placeholder="Or type ticket code" autoComplete="off"
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm font-mono tracking-wider focus:outline-none focus:border-indigo-500" />
        <button type="submit" disabled={busy || !manualCode.trim()} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2.5 rounded-lg text-sm transition">
          {busy ? '…' : 'Check in'}
        </button>
      </form>
      {result && (
        <div className={'mb-4 p-4 rounded-xl border ' + (result.status === 'success' ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200' : 'bg-red-950/50 border-red-700 text-red-200')}>
          <strong className="text-base">{result.status === 'success' ? '✓ Checked in' : '✗ ' + result.message}</strong>
          {result.holderName && <p className="mt-1 text-sm opacity-90">{result.holderName}</p>}
        </div>
      )}
      {stats.recent && stats.recent.length > 0 && (
        <div className="mt-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Recent check-ins</h3>
          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
            {stats.recent.map((r) => (
              <li key={r.ticketCode + (r.checkedInAt || '')} className="flex justify-between items-center bg-gray-900/80 border border-gray-800 rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-mono text-emerald-300 text-xs">{r.ticketCode}</span>
                  {r.holderName && <span className="text-gray-300 ml-2">{r.holderName}</span>}
                </div>
                <span className="text-xs text-gray-500">{r.checkedInAt ? new Date(r.checkedInAt).toLocaleTimeString() : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
