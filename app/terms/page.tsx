export default function TermsPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-white">
      <h1 className="text-3xl font-extrabold mb-2">Terms of Service</h1>
      <p className="text-gray-400 text-sm mb-8">Last updated: July 2026</p>

      {[
        {
          title: '1. Acceptance of Terms',
          body: 'By using TicketHub, you agree to these terms. If you do not agree, please do not use our platform.',
        },
        {
          title: '2. Ticket Purchases',
          body: 'All ticket purchases are final unless the event is cancelled by the organizer. In the case of cancellation, a full refund will be issued automatically. TicketHub is not responsible for events that are postponed or materially changed by the organizer.',
        },
        {
          title: '3. Organizer Responsibilities',
          body: 'Event organizers are responsible for the accuracy of event information, delivering the event as described, and handling any disputes with attendees. TicketHub reserves the right to suspend organizer accounts that violate these terms.',
        },
        {
          title: '4. Prohibited Activities',
          body: 'You may not use TicketHub to sell counterfeit tickets, engage in fraudulent transactions, or violate any applicable laws. Accounts found engaging in prohibited activities will be suspended immediately.',
        },
        {
          title: '5. Fees',
          body: 'TicketHub charges a service fee on ticket sales. This fee is communicated to organizers at the time of account setup. Payment processing fees are charged separately by Paystack.',
        },
        {
          title: '6. Limitation of Liability',
          body: 'TicketHub is a ticketing platform and is not liable for the quality, safety, or delivery of events. Our liability is limited to the amount paid for tickets through our platform.',
        },
        {
          title: '7. Changes to Terms',
          body: 'We may update these terms from time to time. Continued use of TicketHub after changes constitutes acceptance of the new terms.',
        },
        {
          title: '8. Contact',
          body: 'For questions about these terms, contact us at support@tickethub.co.ke.',
        },
      ].map((section) => (
        <section key={section.title} className="mb-7">
          <h2 className="text-lg font-bold text-white mb-2">{section.title}</h2>
          <p className="text-gray-300" style={{ lineHeight: 1.8 }}>{section.body}</p>
        </section>
      ))}
    </div>
  );
}