import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Navbar from './components/Navbar';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TicketHub — Events & Tickets in Kenya',
  description: 'Buy tickets for concerts, festivals and live events in Kenya. Pay via M-Pesa or card.',
};

const WA_HREF = 'https://wa.me/254114525941?text=Hi%20TicketHub%2C%20I%20need%20help%20with%20my%20ticket.';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-50`}>
        <Navbar />
        {children}
        <a href={WA_HREF} target="_blank" rel="noopener noreferrer" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000, background: '#25D366', color: '#fff', borderRadius: '50%', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', textDecoration: 'none' }} aria-label="Chat on WhatsApp">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M16 2C8.268 2 2 8.268 2 16c0 2.494.651 4.836 1.789 6.861L2 30l7.347-1.774A13.932 13.932 0 0016 30c7.732 0 14-6.268 14-14S23.732 2 16 2zm0 25.6a11.533 11.533 0 01-5.88-1.607l-.422-.25-4.36 1.052 1.083-4.25-.276-.436A11.556 11.556 0 014.4 16C4.4 9.593 9.593 4.4 16 4.4S27.6 9.593 27.6 16 22.407 27.6 16 27.6zm6.29-8.614c-.344-.172-2.036-1.004-2.352-1.119-.316-.115-.546-.172-.776.172-.23.344-.89 1.119-1.09 1.349-.2.23-.4.258-.744.086-.344-.172-1.452-.535-2.766-1.707-1.022-.912-1.712-2.037-1.912-2.381-.2-.344-.021-.53.15-.701.155-.154.344-.402.516-.603.172-.2.23-.344.344-.574.115-.23.058-.431-.029-.603-.086-.172-.776-1.87-1.063-2.56-.28-.672-.564-.581-.776-.592l-.66-.011c-.23 0-.603.086-.919.431-.316.344-1.205 1.177-1.205 2.87s1.234 3.328 1.406 3.558c.172.23 2.428 3.707 5.882 5.198.823.355 1.464.567 1.964.726.825.263 1.576.226 2.169.137.661-.099 2.036-.832 2.323-1.635.287-.803.287-1.491.2-1.635-.086-.144-.316-.23-.66-.402z"/></svg>
        </a>
      </body>
    </html>
  );
}