export default function AboutPage() {
  return (
    <div style={{ maxWidth: 700, margin: '3rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>About TicketHub</h1>
      <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 32 }}>Kenya&apos;s premier event ticketing platform</p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Who We Are</h2>
        <p style={{ color: '#374151', lineHeight: 1.8 }}>
          TicketHub is a Kenyan-built online ticketing platform that connects event organizers with their audiences.
          We make it easy for organizers to create, promote, and sell tickets for concerts, festivals, comedy shows,
          corporate events, and more — while giving attendees a seamless, secure way to discover and attend live events.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Our Mission</h2>
        <p style={{ color: '#374151', lineHeight: 1.8 }}>
          To make live events more accessible to everyone in Kenya by providing a simple, reliable, and affordable
          ticketing solution that works for organizers of all sizes — from small community events to large concerts.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Why TicketHub?</h2>
        <ul style={{ color: '#374151', lineHeight: 2, paddingLeft: 20 }}>
          <li>Pay via M-Pesa or card — no cash needed</li>
          <li>Instant digital QR-code tickets delivered by email</li>
          <li>Fast, mobile-friendly check-in at the door</li>
          <li>Real-time sales tracking for organizers</li>
          <li>Dedicated support via WhatsApp</li>
        </ul>
      </section>

      <section>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Contact Us</h2>
        <p style={{ color: '#374151', lineHeight: 1.8 }}>
          Email: <a href="mailto:support@tickethub.co.ke" style={{ color: '#6366f1' }}>support@tickethub.co.ke</a><br/>
          WhatsApp: <a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>+254 114 525 941</a>
        </p>
      </section>
    </div>
  );
}