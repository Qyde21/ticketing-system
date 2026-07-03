export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 700, margin: '3rem auto', padding: '0 1.5rem' }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 32 }}>Last updated: July 2026</p>

      {[
        {
          title: '1. Information We Collect',
          body: 'We collect your name, email address, and phone number when you sign up or purchase a ticket. We also collect payment information which is processed securely by Paystack — we do not store your card details.',
        },
        {
          title: '2. How We Use Your Information',
          body: 'We use your information to process ticket purchases, send ticket confirmations and event updates, provide customer support, and improve our platform.',
        },
        {
          title: '3. Sharing Your Information',
          body: 'We share your name and contact details with event organizers for events you have purchased tickets for. We do not sell your personal information to third parties.',
        },
        {
          title: '4. Data Security',
          body: 'We take reasonable measures to protect your personal information. All payments are processed by Paystack using industry-standard encryption.',
        },
        {
          title: '5. Cookies',
          body: 'We use session cookies to keep you logged in. We do not use tracking or advertising cookies.',
        },
        {
          title: '6. Your Rights',
          body: 'You can request access to, correction of, or deletion of your personal data by contacting us at support@tickethub.co.ke.',
        },
        {
          title: '7. Contact',
          body: 'For privacy-related questions, contact us at support@tickethub.co.ke or via WhatsApp at +254 114 525 941.',
        },
      ].map((section) => (
        <section key={section.title} style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>{section.title}</h2>
          <p style={{ color: '#374151', lineHeight: 1.8, margin: 0 }}>{section.body}</p>
        </section>
      ))}
    </div>
  );
}