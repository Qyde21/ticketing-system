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

  return (
    <div style={{ maxWidth: 600, margin: '3rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Contact Us</h1>
      <p style={{ color: '#6b7280', marginBottom: 32 }}>We typically respond within 24 hours. You can also reach us instantly on WhatsApp.</p>

      <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
        <a href="https://wa.me/254114525941" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#25D366', color: '#fff', padding: '10px 20px', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
          WhatsApp Support
        </a>
        <a href="mailto:support@tickethub.co.ke" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#f3f4f6', color: '#111827', padding: '10px 20px', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: 14 }}>
          support@tickethub.co.ke
        </a>
      </div>

      {success ? (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 24, textAlign: 'center' }}>
          <h2 style={{ color: '#16a34a', margin: '0 0 8px' }}>Message sent!</h2>
          <p style={{ color: '#166534', margin: 0 }}>Thank you for reaching out. We will get back to you within 24 hours.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Your name" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Email address</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="your@email.com" style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Subject</label>
            <select value={subject} onChange={(e) => setSubject(e.target.value)} required style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14, boxSizing: 'border-box' }}>
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
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} required placeholder="Describe your issue or question..." rows={5} style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: 13, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ background: '#6366f1', color: '#fff', padding: '12px 0', borderRadius: 8, fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer' }}>
            {loading ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}
    </div>
  );
}