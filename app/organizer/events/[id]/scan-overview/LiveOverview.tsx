'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Recent { ticketCode: string; holderName: string | null; ticketType: string | null; checkedInAt: string | null }
interface Stats { total: number; checkedIn: number; remaining: number; cancelled: number; recent: Recent[] }

export default function LiveOverview({ eventId, initial }: { eventId: string; initial: Stats }) {
  const [stats, setStats] = useState<Stats>(initial);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkin?eventId=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setStats({ total: Number(data.total)||0, checkedIn: Number(data.checkedIn)||0, remaining: Number(data.remaining)||0, cancelled: Number(data.cancelled)||0, recent: data.recent || [] });
      setUpdatedAt(new Date());
    } catch {}
  }, [eventId]);
  useEffect(() => { const id = setInterval(refresh, 3000); return () => clearInterval(id); }, [refresh]);
  const percent = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
  return (
    <div>
      <div className="flex gap-3 mt-4 flex-wrap">
        {[
          { label: 'Total tickets', value: stats.total, color: 'text-indigo-400' },
          { label: 'Checked in', value: stats.checkedIn, color: 'text-emerald-400' },
          { label: 'Not yet in', value: stats.remaining, color: 'text-amber-400' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-400' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-center" style={{ minWidth: 120 }}>
            <div className={'text-2xl font-bold ' + stat.color}>{stat.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 bg-gray-800 rounded-full overflow-hidden" style={{ height: 8 }}>
        <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1 flex justify-between">
        <span>{percent}% checked in · live every 3s</span>
        <button type="button" onClick={() => void refresh()} className="text-indigo-400 hover:underline">Refresh now{updatedAt && <span className="text-gray-600 ml-1">({updatedAt.toLocaleTimeString()})</span>}</button>
      </p>
      <Link href={`/scan/${eventId}`} className="inline-block mt-3 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-semibold text-sm transition">Open Scanner</Link>
      <h2 className="text-xl font-bold mt-6 mb-3">Recent check-ins</h2>
      {stats.recent.length === 0 ? <p className="text-gray-500 text-sm">No check-ins yet.</p> : (
        <ul className="list-none p-0 space-y-2">
          {stats.recent.map((t) => (
            <li key={t.ticketCode + (t.checkedInAt || '')} className="flex justify-between items-center px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl">
              <div>
                <strong className="text-sm text-white font-mono">{t.ticketCode}</strong>
                <div className="text-xs text-gray-400">{t.holderName || 'Guest'}{t.ticketType ? ` · ${t.ticketType}` : ''}</div>
              </div>
              <span className="text-xs text-emerald-400 font-medium">{t.checkedInAt ? new Date(t.checkedInAt).toLocaleTimeString() : '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
