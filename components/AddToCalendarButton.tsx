'use client';

import { buildGoogleCalendarUrl, buildICS } from '@/lib/calendar';

interface AddToCalendarButtonProps {
  title: string;
  description?: string;
  location?: string;
  startAt: string | Date;
  endAt?: string | Date | null;
}

export default function AddToCalendarButton({ title, description, location, startAt, endAt }: AddToCalendarButtonProps) {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : undefined;

  if (isNaN(start.getTime())) return null;

  const googleUrl = buildGoogleCalendarUrl({ title, description, location, start, end });

  function handleDownloadIcs() {
    const ics = buildICS({ title, description, location, start, end });
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <a
        href={googleUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
      >
        Add to Google Calendar
      </a>
      <button
        type="button"
        onClick={handleDownloadIcs}
        className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition"
      >
        Download .ics (Apple / Outlook)
      </button>
    </div>
  );
}
