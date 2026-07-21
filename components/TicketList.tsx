"use client";

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
  return (
    <div className="space-y-4 pt-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Your Tickets ({quantity})</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {tickets.map((t, idx) => (
          <div key={t.ticketCode} className="bg-gray-900 border border-gray-800 p-4 rounded-xl flex flex-col items-center space-y-3">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Ticket #{idx + 1} of {quantity}</span>
            <div className="bg-white p-3 rounded-xl">
              <QRCodeSVG value={t.qrData} size={130} />
            </div>
            <span className="font-mono text-xs text-gray-400">{t.ticketCode}</span>
            <button 
              type="button"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator.share({
                    title: `${eventTitle} - Ticket #${idx + 1}`,
                    text: `Here is my ticket #${idx + 1} for ${eventTitle}. Reference: ${t.ticketCode}`,
                    url: window.location.href,
                  }).catch(() => {});
                } else if (typeof navigator !== "undefined") {
                  navigator.clipboard.writeText(t.ticketCode);
                  alert("Ticket code copied to clipboard!");
                }
              }}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-xs font-bold uppercase tracking-wider text-white rounded-lg transition"
            >
              Share / Copy Ticket
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
