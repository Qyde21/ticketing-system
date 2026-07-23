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
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4 pt-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-400">Your Tickets ({quantity})</h3>
      <div className="space-y-2">
        {tickets.map((t, idx) => {
          const isOpen = expanded.has(idx);
          return (
            <div key={t.ticketCode} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-bold text-white">Ticket #{idx + 1} of {quantity}</span>
                <span className={`text-gray-400 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 flex flex-col items-center space-y-3 border-t border-gray-800 pt-4">
                  <div className="bg-white p-3 rounded-xl">
                    <QRCodeSVG value={t.qrData} size={130} />
                  </div>
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
