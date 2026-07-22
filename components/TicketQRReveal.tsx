"use client";

import { useState } from "react";

export default function TicketQRReveal({ qrDataUrl }: { qrDataUrl: string }) {
  const [revealed, setRevealed] = useState(false);

  if (revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(false)}
        title="Tap to hide"
        style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
      >
        <img src={qrDataUrl} alt="Ticket QR code" style={{ width: 220, height: 220 }} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRevealed(true)}
      style={{
        width: 220,
        height: 220,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: "#1f1f1f",
        border: "1px dashed #444",
        borderRadius: 12,
        color: "#999",
        cursor: "pointer",
        margin: "0 auto"
      }}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 600 }}>Tap to Reveal QR Code</span>
    </button>
  );
}
