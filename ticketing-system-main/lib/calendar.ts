function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatGoogleDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export interface CalendarEventInput {
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
}

/** Default event duration if no end time is known (3 hours). */
const DEFAULT_DURATION_MS = 3 * 60 * 60 * 1000;

export function buildGoogleCalendarUrl(input: CalendarEventInput): string {
  const start = input.start;
  const end = input.end || new Date(start.getTime() + DEFAULT_DURATION_MS);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    dates: `${formatGoogleDate(start)}/${formatGoogleDate(end)}`,
    details: input.description || '',
    location: input.location || '',
  });

  return `https://www.google.com/calendar/render?${params.toString()}`;
}

export function buildICS(input: CalendarEventInput): string {
  const start = input.start;
  const end = input.end || new Date(start.getTime() + DEFAULT_DURATION_MS);

  const escapeText = (text: string) =>
    text.replace(/[\\;,]/g, (match) => '\\' + match).replace(/\n/g, '\\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TicketHub//Event//EN',
    'BEGIN:VEVENT',
    `UID:${Date.now()}@tickethub.co.ke`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${formatICSDate(start)}`,
    `DTEND:${formatICSDate(end)}`,
    `SUMMARY:${escapeText(input.title)}`,
    `DESCRIPTION:${escapeText(input.description || '')}`,
    `LOCATION:${escapeText(input.location || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}
