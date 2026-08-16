import Link from 'next/link';

export default function PricingPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 text-white">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-2">Simple, Transparent Pricing</h1>
        <p className="text-gray-400 text-lg">No hidden fees. Only pay when you sell tickets.</p>
      </div>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">

        {/* Attendee */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-3">Attendee</div>
          <div className="text-5xl font-extrabold text-white mb-1">Free</div>
          <p className="text-gray-400 text-sm mb-6">Sign up and buy tickets at no extra cost</p>
          <ul className="flex flex-col gap-2.5 mb-6 list-none p-0">
            {[
              'Free account creation',
              'Browse all events',
              'Pay via M-Pesa or card',
              'Instant QR-code ticket by email',
              'WhatsApp support',
            ].map((item) => (
              <li key={item} className="flex gap-2 text-sm text-gray-300">
                <span className="text-emerald-400 font-bold">&#10003;</span> {item}
              </li>
            ))}
          </ul>
          <Link href="/signup" className="block text-center bg-gray-800 hover:bg-gray-700 text-white py-2.5 rounded-lg font-semibold text-sm transition">
            Sign up free
          </Link>
        </div>

        {/* Organizer */}
        <div className="relative bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-8 shadow-lg shadow-indigo-950/50">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-xs font-extrabold px-3 py-1 rounded-full whitespace-nowrap">
            MOST POPULAR
          </div>
          <div className="text-xs font-bold text-indigo-200 uppercase tracking-wider mb-3">Organizer</div>
          <div className="text-5xl font-extrabold text-white mb-1">10%</div>
          <p className="text-indigo-200 text-sm mb-6">Per ticket sold. No upfront costs.</p>
          <ul className="flex flex-col gap-2.5 mb-6 list-none p-0">
            {[
              'Free account creation',
              'Create unlimited events',
              'Sell via M-Pesa or card',
              'Real-time sales dashboard',
              'QR code check-in scanner',
              'Automatic refunds on cancellation',
              'Payout tracking',
              'WhatsApp support',
            ].map((item) => (
              <li key={item} className="flex gap-2 text-sm text-indigo-100">
                <span className="text-amber-400 font-bold">&#10003;</span> {item}
              </li>
            ))}
          </ul>
          <Link href="/signup?role=organizer" className="block text-center bg-amber-400 hover:bg-amber-300 text-black py-2.5 rounded-lg font-bold text-sm transition">
            Start selling tickets
          </Link>
        </div>

      </div>

      {/* FAQ section */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
        <h2 className="text-xl font-bold text-white mb-6">Pricing FAQ</h2>
        <div className="flex flex-col gap-5">
          {[
            {
              q: 'How does the 10% fee work?',
              a: 'For every ticket sold, TicketHub deducts a 10% service fee from the ticket price. For example, if you sell a KES 1,000 ticket, you receive KES 900. The fee is automatically deducted - no invoices or manual payments needed.',
            },
            {
              q: 'Are there any other fees?',
              a: "Paystack charges a separate payment processing fee (typically 1.5% + KES 100 per transaction for local cards, and 3.9% for international cards). This is charged by Paystack directly and is separate from TicketHub's 10% fee.",
            },
            {
              q: 'When do I get paid?',
              a: 'Payouts are processed by Paystack after ticket sales. Settlement timelines depend on your Paystack account settings, typically 1-3 business days after the transaction.',
            },
            {
              q: 'What if I need to refund a ticket?',
              a: 'If you cancel an event, all paid tickets are automatically refunded in full. For individual refunds, you can process them from your organizer dashboard. The 10% fee is also refunded to the attendee.',
            },
            {
              q: 'Is there a minimum number of tickets I need to sell?',
              a: 'No minimum. You can sell as few or as many tickets as you like.',
            },
          ].map((item) => (
            <div key={item.q} className="border-b border-gray-800 pb-5 last:border-0 last:pb-0">
              <h3 className="text-sm font-bold text-white mb-1.5">{item.q}</h3>
              <p className="text-sm text-gray-400" style={{ lineHeight: 1.7 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center mt-12">
        <p className="text-gray-400 mb-4">Ready to start selling tickets?</p>
        <Link href="/signup?role=organizer" className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white py-3 px-8 rounded-lg font-bold text-base transition shadow-lg shadow-indigo-950/50">
          Create your organizer account
        </Link>
      </div>
    </div>
  );
}