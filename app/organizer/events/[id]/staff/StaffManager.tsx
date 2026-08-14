'use client';
import { useState } from 'react';

type StaffMember = { id: string; full_name: string; email: string };

type InviteResult = {
  email: string;
  status: string;
  message?: string;
  staff?: StaffMember;
  emailSent?: boolean;
};

export default function StaffManager({
  eventId,
  initialStaff,
}: {
  eventId: string;
  initialStaff: StaffMember[];
}) {
  const [staff, setStaff] = useState<StaffMember[]>(initialStaff);
  const [emailsText, setEmailsText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<InviteResult[] | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setResults(null);
    const trimmed = emailsText.trim();
    if (!trimmed) {
      setError('Enter at least one email');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailsText: trimmed }),
      });
      const data = await res.json();
      if (data.results && Array.isArray(data.results)) {
        setResults(data.results as InviteResult[]);
      }

      if (!res.ok && !data.results) {
        setError(data.error || 'Could not add staff');
        return;
      }

      const addedStaff: StaffMember[] = [];
      if (data.added && Array.isArray(data.added)) {
        addedStaff.push(...data.added);
      } else if (data.staff) {
        addedStaff.push(data.staff);
      } else if (data.results) {
        for (const r of data.results as InviteResult[]) {
          if (r.status === 'added' && r.staff) addedStaff.push(r.staff);
        }
      }

      if (addedStaff.length > 0) {
        setStaff((prev) => {
          const map = new Map(prev.map((s) => [s.id, s]));
          for (const s of addedStaff) map.set(s.id, s);
          return Array.from(map.values()).sort((a, b) =>
            a.full_name.localeCompare(b.full_name)
          );
        });
      }

      const summary = data.summary as
        | { added: number; alreadyStaff: number; notFound: number; failed: number; emailsSent: number }
        | undefined;

      if (summary) {
        const parts: string[] = [];
        if (summary.added) parts.push(`${summary.added} added`);
        if (summary.emailsSent) parts.push(`${summary.emailsSent} email${summary.emailsSent === 1 ? '' : 's'} sent`);
        if (summary.alreadyStaff) parts.push(`${summary.alreadyStaff} already staff`);
        if (summary.notFound) parts.push(`${summary.notFound} no account`);
        if (summary.failed) parts.push(`${summary.failed} failed`);
        setMessage(parts.length ? parts.join(' · ') : data.error || 'Done');
        if (summary.added > 0) setEmailsText('');
        if (summary.added === 0 && (summary.notFound || summary.failed)) {
          setError(data.error || 'No new staff were added — see details below');
        }
      } else if (res.ok) {
        setMessage(
          data.emailSent
            ? `${data.staff?.full_name || 'Staff'} added and invite email sent.`
            : `${data.staff?.full_name || 'Staff'} added.`
        );
        setEmailsText('');
      } else if (res.status === 409 && data.alreadyStaff) {
        setError(data.error || 'Already door staff');
      } else {
        setError(data.error || 'Could not add staff');
      }
    } catch {
      setError('Network error — try again');
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(userId: string) {
    setError('');
    setMessage('');
    setResults(null);
    const res = await fetch(
      `/api/events/${eventId}/staff?userId=${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    if (res.ok) {
      setStaff((prev) => prev.filter((s) => s.id !== userId));
      setMessage('Staff member removed');
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Could not remove staff');
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleInvite} className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">
          Invite staff by email
        </h2>
        <p className="text-xs text-gray-500">
          Paste one or many emails (comma, space, or new line). Each person must already have a
          TicketHub account. We email them the scanner link automatically.
        </p>
        <textarea
          value={emailsText}
          onChange={(e) => setEmailsText(e.target.value)}
          placeholder={'staff1@example.com\nstaff2@example.com\nstaff3@example.com'}
          rows={4}
          className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2.5 text-sm text-white font-mono"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
        >
          {loading ? 'Inviting…' : 'Add staff & send email'}
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {message && <p className="text-emerald-400 text-sm">{message}</p>}
        {results && results.length > 0 && (
          <ul className="text-xs space-y-1 mt-2 border-t border-gray-800 pt-3">
            {results.map((r) => (
              <li key={r.email} className="flex flex-wrap gap-x-2">
                <span className="text-gray-300 font-mono">{r.email}</span>
                <span
                  className={
                    r.status === 'added'
                      ? 'text-emerald-400'
                      : r.status === 'already_staff'
                        ? 'text-amber-400'
                        : 'text-red-400'
                  }
                >
                  {r.status === 'added'
                    ? r.emailSent
                      ? 'added · email sent'
                      : 'added · email failed'
                    : r.message || r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </form>
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400 mb-3">
          Current staff ({staff.length})
        </h2>
        {staff.length === 0 ? (
          <p className="text-gray-500 text-sm">No staff yet.</p>
        ) : (
          <ul className="space-y-2">
            {staff.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-white text-sm">{s.full_name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRemove(s.id)}
                  className="text-xs font-semibold text-red-400 px-3 py-1.5 rounded-lg bg-red-950/30 border border-red-900/50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}