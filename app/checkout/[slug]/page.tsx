import { sql } from '@/lib/db';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = await params;
  const ticketIdOrSlug = resolvedParams?.slug;

  if (!ticketIdOrSlug) {
    notFound();
  }

  let ticketType: any = null;
  let event: any = null;

  try {
    const ttRes = await sql`
      SELECT tt.*, e.title as event_title, e.cover_image_url, e.image_url
      FROM ticket_types tt
      JOIN events e ON e.id::text = tt.event_id::text
      WHERE tt.id::text = ${ticketIdOrSlug} OR tt.name ILIKE ${ticketIdOrSlug.replace(/-/g, ' ')}
      LIMIT 1
    `;

    if (ttRes.length === 0) {
      notFound();
    }

    ticketType = ttRes[0];
    event = {
      title: ticketType.event_title,
      cover_image_url: ticketType.cover_image_url || ticketType.image_url
    };

  } catch (err) {
    console.error("Error loading checkout details:", err);
    notFound();
  }

  const priceNum = parseFloat(ticketType.price_kes || 0);
  const total = ticketType.quantity_total ?? 0;
  const sold = ticketType.quantity_sold ?? 0;
  const remaining = Math.max(0, total - sold);

  return (
    <main className="max-w-2xl mx-auto px-4 py-12 text-white">
      <div className="mb-6">
        <Link href={`/events`} className="text-indigo-400 hover:underline text-sm font-semibold">
          ← Back to Events
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-indigo-400 bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-800/50">
            Checkout
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">{event.title}</h1>
        </div>

        <div className="bg-gray-950 border border-gray-800 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center pb-3 border-b border-gray-800">
            <div>
              <h3 className="font-bold text-lg text-white">{ticketType.name} Ticket</h3>
              <p className="text-xs text-gray-400">{remaining} tickets remaining</p>
            </div>
            <span className="text-cyan-400 font-extrabold text-lg">
              KES {priceNum.toLocaleString()}
            </span>
          </div>
        </div>

        <form action="/api/orders" method="POST" className="space-y-4 pt-2">
          <input type="hidden" name="ticket_type_id" value={ticketType.id} />
          <input type="hidden" name="event_id" value={ticketType.event_id} />

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">Your Full Name</label>
            <input 
              type="text" 
              name="attendee_name" 
              required 
              placeholder="John Doe" 
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">Email Address</label>
            <input 
              type="email" 
              name="attendee_email" 
              required 
              placeholder="john@example.com" 
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1">Phone Number (M-PESA)</label>
            <input 
              type="text" 
              name="attendee_phone" 
              required 
              placeholder="0712345678" 
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          <button 
            type="submit"
            className="w-full py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl uppercase tracking-wider text-sm transition shadow-lg shadow-green-950/50 mt-4 cursor-pointer"
          >
            Complete Purchase — KES {priceNum.toLocaleString()}
          </button>
        </form>
      </div>
    </main>
  );
}