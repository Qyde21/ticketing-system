'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface Recent {
  ticketCode: string;
  holderName: string | null;
  ticketType: string | null;
  checkedInAt: string | null;
  scannedBy?: string | null;
  scannedByEmail?: string | null;
}

interface StaffCount {
  name: string;
  email: string | null;
  count: number;
}

interface Stats {
  total: number;
  checkedIn: number;
  remaining: number;
  cancelled: number;
  recent: Recent[];
  byStaff?: StaffCount[];
}

export default function LiveOverview({
  eventId,
  initial,
  eventEnded = false,
}: {
  eventId: string;
  initial: Stats;
  eventEnded?: boolean;
}) {
  const [stats, setStats] = useState<Stats>(initial);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/checkin?eventId=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        total: Number(data.total) || 0,
        checkedIn: Number(data.checkedIn) || 0,
        remaining: Number(data.remaining) || 0,
        cancelled: Number(data.cancelled) || 0,
        recent: data.recent || [],
        byStaff: data.byStaff || [],
      });
      setUpdatedAt(new Date());
    } catch {
      /* ignore */
    }
  }, [eventId]);

  useEffect(() => {
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  const percent = stats.total > 0 ? Math.round((stats.checkedIn / stats.total) * 100) : 0;
  const byStaff = stats.byStaff || [];

  return (
    <div>
      <div className="flex gap-3 mt-4 flex-wrap">
        {[
          { label: 'Total tickets', value: stats.total, color: 'text-indigo-400' },
          { label: 'Checked in', value: stats.checkedIn, color: 'text-emerald-400' },
          { label: 'Not yet in', value: stats.remaining, color: 'text-amber-400' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-400' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-3 text-center"
            style={{ minWidth: 120 }}
          >
            <div className={'text-2xl font-bold ' + stat.color}>{stat.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 bg-gray-800 rounded-full overflow-hidden" style={{ height: 8 }}>
        <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1 flex justify-between">
        <span>{percent}% checked in</span>
        <button type="button" onClick={() => void refresh()} className="text-indigo-400 hover:underline">
          Refresh now
          {updatedAt && <span className="text-gray-600 ml-1">({updatedAt.toLocaleTimeString()})</span>}
        </button>
      </p>

      {eventEnded ? (
        <span
          className="inline-block mt-3 bg-gray-800 text-gray-500 px-5 py-2 rounded-lg font-semibold text-sm cursor-not-allowed border border-gray-700"
          title="Scanning is closed because this event has ended"
        >
          Open Scanner (closed)
        </span>
      ) : (
        <Link
          href={`/scan/${eventId}`}
          className="inline-block mt-3 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-semibold text-sm transition"
        >
          Open Scanner
        </Link>
      )}

      <h2 className="text-xl font-bold mt-6 mb-3">Staff attendance</h2>
      {byStaff.length === 0 ? (
        <p className="text-gray-500 text-sm mb-4">No check-ins recorded yet.</p>
      ) : (
        <ul className="space-y-2 mb-6">
          {byStaff.map((s) => (
            <li
              key={(s.email || s.name) + String(s.count)}
              className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
            >
              <div>
                <p className="font-semibold text-white text-sm">{s.name}</p>
                {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
              </div>
              <span className="text-sm font-bold text-emerald-400">
                {s.count} scan{s.count === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-xl font-bold mt-2 mb-3">Attendance log</h2>
      {stats.recent.length === 0 ? (
        <p className="text-gray-500 text-sm">No check-ins yet.</p>
      ) : (
        <ul className="list-none p-0 space-y-2">
          {stats.recent.map((t) => (
            <li
              key={t.ticketCode + (t.checkedInAt || '')}
              className="flex justify-between items-start gap-3 px-3 py-2.5 bg-gray-900 border border-gray-800 rounded-xl"
            >
              <div>
                <strong className="text-sm text-white font-mono">{t.ticketCode}</strong>
                <div className="text-xs text-gray-400">
                  {t.holderName || 'Guest'}
                  {t.ticketType ? ` · ${t.ticketType}` : ''}
                </div>
                <div className="text-xs text-indigo-300/90 mt-0.5">
                  Scanned by {t.scannedBy || 'Unknown'}
                  {t.scannedByEmail ? ` (${t.scannedByEmail})` : ''}
                </div>
              </div>
              <span className="text-xs text-emerald-400 font-medium whitespace-nowrap">
                {t.checkedInAt ? new Date(t.checkedInAt).toLocaleTimeString() : '—'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}