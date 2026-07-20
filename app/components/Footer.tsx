import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-slate-900 border-t border-slate-800 text-slate-300 py-12">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          {/* Brand Info */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-3 text-lg font-bold">
              <span className="bg-emerald-600 text-white px-2 py-0.5 rounded text-sm font-black">
                TH
              </span>
              <span className="text-white font-extrabold text-xl">TicketHub</span>
            </Link>
            <p className="text-sm text-slate-400 leading-relaxed">
              Kenya's premier event ticketing platform. Buy and sell tickets for concerts, festivals, and live events.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white text-sm font-bold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/" className="hover:text-white transition">Browse Events</Link></li>
              <li><Link href="/pricing" className="hover:text-white transition">Sell Tickets</Link></li>
              <li><Link href="/login" className="hover:text-white transition">Log In</Link></li>
              <li><Link href="/signup" className="hover:text-white transition">Sign Up</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white text-sm font-bold mb-4">Support</h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li><Link href="/contact" className="hover:text-white transition">Contact Us</Link></li>
              <li><a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">WhatsApp Support</a></li>
              <li><Link href="/faq" className="hover:text-white transition">FAQ</Link></li>
              <li><Link href="/about" className="hover:text-white transition">About Us</Link></li>
            </ul>
          </div>

          {/* Follow Us */}
          <div>
            <h4 className="text-white text-sm font-bold mb-4">Follow Us</h4>
            <div className="flex gap-4 text-sm text-slate-400">
              <a href="https://twitter.com/tickethubke" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Twitter/X</a>
              <a href="https://instagram.com/tickethubke" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Instagram</a>
              <a href="https://facebook.com/tickethubke" target="_blank" rel="noopener noreferrer" className="hover:text-white transition">Facebook</a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-400 gap-4">
          <p>&copy; {new Date().getFullYear()} TicketHub Kenya. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white transition">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
