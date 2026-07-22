"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Ticket {
  ticketCode: string;
  qrData: string;
}

interface TicketListProps {
  tickets: Ticket[];
  eventTitle: string;
  quantity: number;
}

export default function TicketList({ tickets, eventTitle, quantity }: TicketListProps) {
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const toggleReveal = (code: string) => {
    setRevealed((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  return (
    <div className="space-y-4 pt-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Your Tickets ({quantity})</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tickets.map((t, idx) => {
          const isRevealed = !!revealed[t.ticketCode];
          return (
            <div key={t.ticketCode} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col items-center space-y-3">
              <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Ticket #{idx + 1} of {quantity}</span>

              {isRevealed ? (
                <button
                  type="button"
                  onClick={() => toggleReveal(t.ticketCode)}
                  className="bg-white p-3 rounded-xl cursor-pointer"
                  title="Tap to hide"
                >
                  <QRCodeSVG value={t.qrData} size={130} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleReveal(t.ticketCode)}
                  className="bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl flex flex-col items-center justify-center space-y-2 transition"
                  style={{ width: 130, height: 130 }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="text-xs font-semibold text-gray-400 px-2 text-center">Tap to Reveal QR Code</span>
                </button>
              )}

              <button 
                type="button"
                onClick={() => {
                  const ticketUrl = `${window.location.origin}/tickets/${t.ticketCode}`;
                  if (typeof navigator !== "undefined" && navigator.share) {
                    navigator.share({
                      title: `${eventTitle} - Ticket #${idx + 1}`,
                      text: `Here is my ticket #${idx + 1} for ${eventTitle}.`,
                      url: ticketUrl,
                    }).catch(() => {});
                  } else if (typeof navigator !== "undefined") {
                    navigator.clipboard.writeText(ticketUrl);
                    alert("Ticket link copied to clipboard!");
                  }
                }}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition"
              >
                Share / Copy Ticket
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
