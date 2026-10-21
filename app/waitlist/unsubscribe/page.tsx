import { sql } from '@/lib/db';
import { verifyWaitlistUnsubscribeToken } from '@/lib/waitlistUnsubscribe';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Leave the waitlist — TicketHub',
  robots: { index: false, follow: false },
};

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="max-w-md mx-auto px-4 py-16 text-white text-center">
      <h1 className="text-2xl font-extrabold mb-3">{title}</h1>
      <div className="text-gray-400 text-sm space-y-4">{children}</div>
    </main>
  );
}

export default async function WaitlistUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string; error?: string }>;
}) {
  const { token, done, error } = await searchParams;

  if (done) {
    return (
      <Card title="You've been removed">
        <p>You won&apos;t get any more emails about this waitlist.</p>
      </Card>
    );
  }

  const entryId = verifyWaitlistUnsubscribeToken(token);
  if (error || !entryId) {
    return (
      <Card title="This link isn't valid">
        <p>The unsubscribe link is incomplete or has been changed. Please use the link from the most recent email we sent you.</p>
      </Card>
    );
  }

  const [entry] = await sql`
    SELECT e.title AS event_title, tt.name AS ticket_type_name
    FROM waitlist_entries w
    JOIN ticket_types tt ON tt.id = w.ticket_type_id
    JOIN events e ON e.id = tt.event_id
    WHERE w.id = ${entryId}
  `;

  if (!entry) {
    return (
      <Card title="Already removed">
        <p>You&apos;re no longer on this waitlist, so there&apos;s nothing more to do.</p>
      </Card>
    );
  }

  return (
    <Card title="Leave the waitlist?">
      <p>
        Stop waitlist emails for <strong className="text-white">{String(entry.ticket_type_name)}</strong> tickets to{' '}
        <strong className="text-white">{String(entry.event_title)}</strong>.
      </p>
      <form method="POST" action={`/api/waitlist/unsubscribe?token=${encodeURIComponent(String(token))}`}>
        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-5 py-2.5 rounded-lg"
        >
          Yes, remove me
        </button>
      </form>
    </Card>
  );
}
