import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ background: '#111827', color: '#9ca3af', marginTop: 64 }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '48px 24px 24px' }}>

        {/* Top section */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 32, marginBottom: 40 }}>

          {/* Brand */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ background: '#fbbf24', color: '#000', padding: '2px 8px', borderRadius: 4, fontSize: 13, fontWeight: 900 }}>TH</span>
              <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>TicketHub</span>
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
              Kenya&apos;s premier event ticketing platform. Buy and sell tickets for concerts, festivals, and live events.
            </p>
          </div>

          {/* Quick links */}
          <div>
            <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Quick Links</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><Link href="/" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Browse Events</Link></li>
              <li><Link href="/signup?role=organizer" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Sell Tickets</Link></li>
              <li><Link href="/login" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Log In</Link></li>
              <li><Link href="/signup" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Sign Up</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Support</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <li><a href="/contact" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Contact Us</a></li>
              <li><a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>WhatsApp Support</a></li>
              <li><Link href="/faq" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>FAQ</Link></li>
              <li><Link href="/about" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>About Us</Link></li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 700, marginBottom: 12, marginTop: 0 }}>Follow Us</h3>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="https://twitter.com/tickethubke" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Twitter/X</a>
              <a href="https://instagram.com/tickethubke" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Instagram</a>
              <a href="https://facebook.com/tickethubke" target="_blank" rel="noopener noreferrer" style={{ color: '#9ca3af', textDecoration: 'none', fontSize: 14 }}>Facebook</a>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: '1px solid #1f2937', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13 }}>
            &copy; {new Date().getFullYear()} TicketHub Kenya. All rights reserved.
          </p>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <Link href="/privacy" style={{ color: '#9ca3af', textDecoration: 'none' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: '#9ca3af', textDecoration: 'none' }}>Terms of Service</Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
