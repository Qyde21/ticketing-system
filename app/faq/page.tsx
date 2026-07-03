const faqs = [
  {
    q: 'How do I buy a ticket?',
    a: 'Browse events on the homepage, click on an event, fill in your details, and pay via M-Pesa or card. Your ticket will be sent to your email instantly.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We accept M-Pesa and all major debit/credit cards (Visa, Mastercard) via Paystack.',
  },
  {
    q: 'How do I get my ticket after paying?',
    a: 'Your ticket is sent to your email address immediately after payment is confirmed. It contains a QR code that you show at the entrance.',
  },
  {
    q: 'What if I lose my ticket email?',
    a: 'Contact us on WhatsApp with your name and the event you booked. We will help you retrieve your ticket.',
  },
  {
    q: 'Can I get a refund?',
    a: 'Refunds are processed by the event organizer. If an event is cancelled, all paid tickets are automatically refunded. For other refund requests, contact us on WhatsApp.',
  },
  {
    q: 'How do I sell tickets for my event?',
    a: 'Click "Sell tickets" in the top navigation, sign up as an organizer, and create your event. Your account will be reviewed and approved before your event goes live.',
  },
  {
    q: 'How long does organizer approval take?',
    a: 'Organizer accounts are typically reviewed and approved within 24 hours.',
  },
  {
    q: 'When do I receive my payout as an organizer?',
    a: 'Payouts are processed by Paystack after the event. Settlement timelines depend on your Paystack account settings, typically 1-3 business days.',
  },
  {
    q: 'Is my payment information secure?',
    a: 'Yes. All payments are processed by Paystack, a PCI-DSS compliant payment processor. TicketHub never stores your card details.',
  },
  {
    q: 'How do I contact support?',
    a: 'You can reach us via WhatsApp at +254 114 525 941 or email us at support@tickethub.co.ke.',
  },
];

export default function FAQPage() {
  return (
    <div style={{ maxWidth: 700, margin: '3rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Frequently Asked Questions</h1>
      <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 32 }}>Everything you need to know about TicketHub</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {faqs.map((faq, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: '4px solid #6366f1' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111827' }}>{faq.q}</h3>
            <p style={{ margin: 0, color: '#374151', lineHeight: 1.7, fontSize: 14 }}>{faq.a}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, padding: 20, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
        <p style={{ margin: 0, fontSize: 14, color: '#166534' }}>
          Still have questions?{' '}
          <a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', fontWeight: 600 }}>
            Chat with us on WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}