'use client';
import { useState } from 'react';

export default function ContactPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, subject, message }),
    });

    setLoading(false);
    if (res.ok) {
      setSuccess(true);
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } else {
      setError('Failed to send message. Please try again or reach us on WhatsApp.');
    }
  }

  const inputClass = 'w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition';
  const labelClass = 'block text-xs font-semibold text-gray-300 mb-1.5';

  return (
    <div className="max-w-xl mx-auto px-6 py-16 text-white">
      <h1 className="text-3xl font-extrabold mb-2">Contact Us</h1>
      <p className="text-gray-400 mb-8">We typically respond within 24 hours. You can also reach us instantly on WhatsApp.</p>

      <div className="flex gap-3 mb-8 flex-wrap">
        <a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-white py-2.5 px-5 rounded-lg font-semibold text-sm" style={{ background: '#25D366' }}>
          WhatsApp Support
        </a>
        <a href="mailto:support@tickethub.co.ke" className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white py-2.5 px-5 rounded-lg font-semibold text-sm transition">
          support@tickethub.co.ke
        </a>
      </div>

      {success ? (
        <div className="bg-green-950/40 border border-green-800/50 rounded-xl p-6 text-center">
          <h2 className="text-green-400 font-bold mb-1">Message sent!</h2>
          <p className="text-green-300 text-sm">Thank you for reaching out. We will get back to you within 24 hours.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex flex-col gap-4">
          <div>
            <label className={labelClass}>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="your@email.com" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} required className={inputClass}>
              <option value="">Select a subject...</option>
              <option value="Ticket issue">Ticket issue</option>
              <option value="Payment problem">Payment problem</option>
              <option value="Refund request">Refund request</option>
              <option value="Organizer enquiry">Organizer enquiry</option>
              <option value="Technical support">Technical support</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="Describe your issue or question..." rows={5} className={inputClass} style={{ resize: 'vertical' }} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white py-3 rounded-lg font-bold text-sm transition">
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
}