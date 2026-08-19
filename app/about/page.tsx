export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-white">
      <h1 className="text-3xl font-extrabold mb-2">About TicketHub</h1>
      <p className="text-gray-400 text-base mb-10">Kenya&apos;s premier event ticketing platform</p>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-white mb-3">Who We Are</h2>
        <p className="text-gray-300" style={{ lineHeight: 1.8 }}>
          TicketHub is a Kenyan-built online ticketing platform that connects event organizers with their audiences.
          We make it easy for organizers to create, promote, and sell tickets for concerts, festivals, comedy shows,
          corporate events, and more - while giving attendees a seamless, secure way to discover and attend live events.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-white mb-3">Our Mission</h2>
        <p className="text-gray-300" style={{ lineHeight: 1.8 }}>
          To make live events more accessible to everyone in Kenya by providing a simple, reliable, and affordable
          ticketing solution that works for organizers of all sizes - from small community events to large concerts.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-bold text-white mb-3">Why TicketHub?</h2>
        <ul className="text-gray-300 pl-5" style={{ lineHeight: 2 }}>
          <li>Pay via M-Pesa or card - no cash needed</li>
          <li>Instant digital QR-code tickets delivered by email</li>
          <li>Fast, mobile-friendly check-in at the door</li>
          <li>Real-time sales tracking for organizers</li>
          <li>Dedicated support via WhatsApp</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-bold text-white mb-3">Contact Us</h2>
        <p className="text-gray-300" style={{ lineHeight: 1.8 }}>
          Email: <a href="mailto:support@tickethub.co.ke" className="text-indigo-400 hover:underline">support@tickethub.co.ke</a><br/>
          WhatsApp: <a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">+254 114 525 941</a>
        </p>
      </section>
    </div>
  );
}