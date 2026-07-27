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
    <div className="max-w-2xl mx-auto px-6 py-16 text-white">
      <h1 className="text-3xl font-extrabold mb-2">Frequently Asked Questions</h1>
      <p className="text-gray-400 text-base mb-8">Everything you need to know about TicketHub</p>

      <div className="flex flex-col gap-4">
        {faqs.map((faq, i) => (
          <div key={i} className="bg-gray-900 border-l-4 border-indigo-500 rounded-xl p-5">
            <h3 className="text-base font-bold text-white mb-2">{faq.q}</h3>
            <p className="text-sm text-gray-300" style={{ lineHeight: 1.7 }}>{faq.a}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 p-5 bg-green-950/30 border border-green-800/40 rounded-xl">
        <p className="text-sm text-green-300">
          Still have questions?{' '}
          <a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" className="text-green-400 font-semibold hover:underline">
            Chat with us on WhatsApp
          </a>
        </p>
      </div>
    </div>
  );
}