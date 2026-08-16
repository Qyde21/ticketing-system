'use client';

import { useMemo, useState } from 'react';

type StaffMember = { id: string; full_name: string; email: string };
type Assignee = { userId: string; fullName: string; email: string; status: string };
type Shift = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  gate: string | null;
  slotsNeeded: number;
  assignees: Assignee[];
};

function toLocalInputValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ShiftManager({
  eventId,
  initialShifts,
  staff,
  eventEnded,
}: {
  eventId: string;
  initialShifts: Shift[];
  staff: StaffMember[];
  eventEnded: boolean;
}) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [name, setName] = useState('Doors');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [gate, setGate] = useState('');
  const [slotsNeeded, setSlotsNeeded] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const staffOptions = useMemo(() => staff, [staff]);

  async function createShift(e: React.FormEvent) {
    e.preventDefault();
    if (eventEnded) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          name,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
          gate: gate || null,
          slotsNeeded,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create shift');
        return;
      }
      setShifts((prev) =>
        [...prev, data.shift].sort(
          (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
        )
      );
      setMessage('Shift created');
      setName('Doors');
      setGate('');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  async function removeShift(shiftId: string) {
    if (eventEnded) return;
    if (!confirm('Delete this shift and its assignments?')) return;
    setError('');
    const res = await fetch(`/api/events/${eventId}/shifts?shiftId=${encodeURIComponent(shiftId)}`, {
      method: 'DELETE',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not delete shift');
      return;
    }
    setShifts((prev) => prev.filter((s) => s.id !== shiftId));
  }

  async function assign(shiftId: string, userId: string) {
    if (eventEnded || !userId) return;
    setError('');
    const res = await fetch(`/api/events/${eventId}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', shiftId, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not assign');
      return;
    }
    const member = staffOptions.find((s) => s.id === userId);
    if (!member) return;
    setShifts((prev) =>
      prev.map((s) => {
        if (s.id !== shiftId) return s;
        if (s.assignees.some((a) => a.userId === userId)) return s;
        return {
          ...s,
          assignees: [
            ...s.assignees,
            {
              userId: member.id,
              fullName: member.full_name,
              email: member.email,
              status: 'assigned',
            },
          ],
        };
      })
    );
  }

  async function unassign(shiftId: string, userId: string) {
    if (eventEnded) return;
    setError('');
    const res = await fetch(`/api/events/${eventId}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unassign', shiftId, userId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not unassign');
      return;
    }
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? { ...s, assignees: s.assignees.filter((a) => a.userId !== userId) }
          : s
      )
    );
  }

  if (eventEnded) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 px-4 py-4 text-sm text-gray-300">
        This event has ended. Shifts cannot be created or changed.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form onSubmit={createShift} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Add shift</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shift name"
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <input
            value={gate}
            onChange={(e) => setGate(e.target.value)}
            placeholder="Gate / location (optional)"
            className="bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
          <label className="text-xs text-gray-400">
            Starts
            <input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-gray-400">
            Ends
            <input
              type="datetime-local"
              required
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs text-gray-400">
            Slots needed
            <input
              type="number"
              min={1}
              value={slotsNeeded}
              onChange={(e) => setSlotsNeeded(Number(e.target.value) || 1)}
              className="mt-1 w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
        >
          {loading ? 'Saving…' : 'Create shift'}
        </button>
      </form>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {message && <p className="text-emerald-400 text-sm">{message}</p>}

      <div className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
          Shifts ({shifts.length})
        </h2>
        {shifts.length === 0 ? (
          <p className="text-gray-500 text-sm">No shifts yet. Create a window above.</p>
        ) : (
          shifts.map((s) => {
            const under = s.assignees.length < s.slotsNeeded;
            const available = staffOptions.filter(
              (m) => !s.assignees.some((a) => a.userId === m.id)
            );
            return (
              <div key={s.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="flex flex-wrap justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-white">
                      {s.name}
                      {s.gate ? (
                        <span className="text-gray-400 font-normal"> · {s.gate}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(s.startsAt).toLocaleString()} → {new Date(s.endsAt).toLocaleString()}
                    </p>
                    <p className={`text-xs mt-1 ${under ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {s.assignees.length} / {s.slotsNeeded} assigned
                      {under ? ' · understaffed' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void removeShift(s.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Delete
                  </button>
                </div>

                <ul className="space-y-1 mb-3">
                  {s.assignees.map((a) => (
                    <li
                      key={a.userId}
                      className="flex justify-between items-center text-sm bg-gray-950 border border-gray-800 rounded-lg px-3 py-2"
                    >
                      <span>
                        {a.fullName}{' '}
                        <span className="text-gray-500 text-xs">{a.email}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => void unassign(s.id, a.userId)}
                        className="text-xs text-gray-400 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>

                {available.length > 0 ? (
                  <div className="flex gap-2">
                    <select
                      id={`assign-${s.id}`}
                      defaultValue=""
                      className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="">Assign door staff…</option>
                      {available.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.full_name} ({m.email})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm px-3 py-2 rounded-lg"
                      onClick={() => {
                        const el = document.getElementById(`assign-${s.id}`) as HTMLSelectElement | null;
                        if (el?.value) void assign(s.id, el.value);
                      }}
                    >
                      Assign
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">
                    {staffOptions.length === 0
                      ? 'Add door staff first, then assign them here.'
                      : 'All door staff are assigned to this shift.'}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}