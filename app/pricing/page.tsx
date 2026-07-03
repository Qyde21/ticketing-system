import Link from 'next/link';

export default function PricingPage() {
  return (
    <div style={{ maxWidth: 800, margin: '3rem auto', padding: '0 1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Simple, Transparent Pricing</h1>
        <p style={{ color: '#6b7280', fontSize: 18 }}>No hidden fees. Only pay when you sell tickets.</p>
      </div>

      {/* Pricing cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 48 }}>

        {/* Attendee */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Attendee</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Free</div>
          <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24 }}>Sign up and buy tickets at no extra cost</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              'Free account creation',
              'Browse all events',
              'Pay via M-Pesa or card',
              'Instant QR-code ticket by email',
              'WhatsApp support',
            ].map((item) => (
              <li key={item} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#374151' }}>
                <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span> {item}
              </li>
            ))}
          </ul>
          <Link href="/signup" style={{ display: 'block', textAlign: 'center', background: '#f3f4f6', color: '#111827', padding: '10px 0', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
            Sign up free
          </Link>
        </div>

        {/* Organizer */}
        <div style={{ background: '#6366f1', borderRadius: 12, padding: 32, boxShadow: '0 4px 20px rgba(99,102,241,0.3)', border: '1px solid #6366f1', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#fbbf24', color: '#000', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 99, whiteSpace: 'nowrap' }}>
            MOST POPULAR
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c7d2fe', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Organizer</div>
          <div style={{ fontSize: 48, fontWeight: 800, color: '#fff', marginBottom: 4 }}>10%</div>
          <p style={{ color: '#c7d2fe', fontSize: 14, marginBottom: 24 }}>Per ticket sold. No upfront costs.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              <li key={item} style={{ display: 'flex', gap: 8, fontSize: 14, color: '#e0e7ff' }}>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>✓</span> {item}
              </li>
            ))}
          </ul>
          <Link href="/signup?role=organizer" style={{ display: 'block', textAlign: 'center', background: '#fbbf24', color: '#000', padding: '10px 0', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 14 }}>
            Start selling tickets
          </Link>
        </div>

      </div>

      {/* FAQ section */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 24 }}>Pricing FAQ</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {[
            {
              q: 'How does the 10% fee work?',
              a: 'For every ticket sold, TicketHub deducts a 10% service fee from the ticket price. For example, if you sell a KES 1,000 ticket, you receive KES 900. The fee is automatically deducted — no invoices or manual payments needed.',
            },
            {
              q: 'Are there any other fees?',
              a: 'Paystack charges a separate payment processing fee (typically 1.5% + KES 100 per transaction for local cards, and 3.9% for international cards). This is charged by Paystack directly and is separate from TicketHub\'s 10% fee.',
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
            <div key={item.q} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 6, marginTop: 0 }}>{item.q}</h3>
              <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7, margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <p style={{ color: '#6b7280', marginBottom: 16 }}>Ready to start selling tickets?</p>
        <Link href="/signup?role=organizer" style={{ display: 'inline-block', background: '#6366f1', color: '#fff', padding: '12px 32px', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: 16 }}>
          Create your organizer account
        </Link>
      </div>
    </div>
  );
}